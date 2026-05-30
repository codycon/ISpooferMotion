use futures_util::StreamExt;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::env;
use std::fs;
use std::path::PathBuf;
use std::process::Command;
use tauri::{AppHandle, Emitter};

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct UpdateInfo {
    pub has_update: bool,
    pub latest_version: String,
    pub plugin_url: String,
    pub app_url: String,
}

#[derive(Serialize, Deserialize, Debug)]
struct GithubRelease {
    tag_name: String,
    assets: Vec<GithubAsset>,
}

#[derive(Serialize, Deserialize, Debug)]
struct GithubAsset {
    name: String,
    browser_download_url: String,
}

const GITHUB_API_URL: &str =
    "https://api.github.com/repos/IncrediDev/ISpooferMotion/releases/latest";
const CURRENT_VERSION: &str = env!("CARGO_PKG_VERSION");

#[tauri::command]
pub async fn check_for_updates() -> crate::error::Result<UpdateInfo> {
    let client = Client::builder().user_agent("ISpooferMotion-Updater").build()?;

    let res = client.get(GITHUB_API_URL).send().await;

    match res {
        Ok(response) => {
            if response.status().is_success() {
                if let Ok(release) = response.json::<GithubRelease>().await {
                    let latest_version = release.tag_name.replace("v", "");

                    let has_update = latest_version != CURRENT_VERSION;

                    let mut plugin_url = String::new();
                    let mut app_url = String::new();

                    let os_ext = if cfg!(target_os = "windows") {
                        ".exe"
                    } else if cfg!(target_os = "macos") {
                        ".dmg"
                    } else {
                        ".AppImage"
                    };

                    for asset in release.assets {
                        if asset.name.ends_with(".rbxmx") {
                            plugin_url = asset.browser_download_url.clone();
                        } else if asset.name.ends_with(os_ext) || asset.name.ends_with(".msi") {
                            app_url = asset.browser_download_url.clone();
                        }
                    }

                    if plugin_url.is_empty() {
                        return Ok(UpdateInfo {
                            has_update: false,
                            latest_version: CURRENT_VERSION.to_string(),
                            plugin_url: String::new(),
                            app_url: String::new(),
                        });
                    }

                    return Ok(UpdateInfo { has_update, latest_version, plugin_url, app_url });
                }
            }
        }
        Err(e) => {
            log::warn!("Failed to check for updates: {}", e);
        }
    }

    Ok(UpdateInfo {
        has_update: false,
        latest_version: CURRENT_VERSION.to_string(),
        plugin_url: String::new(),
        app_url: String::new(),
    })
}

#[tauri::command]
pub async fn download_and_install_plugin(
    app: AppHandle,
    plugin_url: String,
    app_url: String,
) -> crate::error::Result<bool> {
    let client = Client::builder().user_agent("ISpooferMotion-Updater").build()?;

    let res = client.get(&plugin_url).send().await?;

    if !res.status().is_success() {
        return Err(format!("Failed to download plugin: HTTP {}", res.status()).into());
    }

    let total_size = res.content_length().unwrap_or(0);

    let local_app_data = env::var("LOCALAPPDATA")
        .map_err(|_| "Could not find LOCALAPPDATA environment variable".to_string())?;
    let plugins_dir = PathBuf::from(local_app_data).join("Roblox").join("Plugins");

    if !plugins_dir.exists() {
        fs::create_dir_all(&plugins_dir)?;
    }

    if let Ok(entries) = fs::read_dir(&plugins_dir) {
        for entry in entries.flatten() {
            if let Some(file_name) = entry.file_name().to_str() {
                if file_name.starts_with("ISpooferMotion") {
                    let path = entry.path();
                    if path.is_dir() {
                        let _ = fs::remove_dir_all(&path);
                    } else if file_name.ends_with(".rbxmx") || file_name.ends_with(".lua") {
                        let _ = fs::remove_file(&path);
                    }
                }
            }
        }
    }

    let target_path = plugins_dir.join("ISpooferMotion.rbxmx");
    let mut file = fs::File::create(&target_path)?;

    use std::io::Write;
    let mut downloaded: u64 = 0;
    let mut stream = res.bytes_stream();

    while let Some(item) = stream.next().await {
        let chunk = item?;
        file.write_all(&chunk)?;

        downloaded += chunk.len() as u64;

        if total_size > 0 {
            let progress = (downloaded as f64 / total_size as f64 * 50.0) as u32;
            let _ = app.emit("download-progress", progress);
        }
    }

    if !app_url.is_empty() {
        let app_res = client.get(&app_url).send().await?;
        if app_res.status().is_success() {
            let app_total_size = app_res.content_length().unwrap_or(0);

            let temp_dir = env::temp_dir();

            let file_name =
                app_url.split('/').next_back().unwrap_or("ISpooferMotion_Installer.exe");
            let app_target_path = temp_dir.join(file_name);

            let mut app_file = fs::File::create(&app_target_path)?;
            let mut app_downloaded: u64 = 0;
            let mut app_stream = app_res.bytes_stream();

            while let Some(item) = app_stream.next().await {
                let chunk = item?;
                app_file.write_all(&chunk)?;
                app_downloaded += chunk.len() as u64;

                if app_total_size > 0 {
                    let progress =
                        50 + (app_downloaded as f64 / app_total_size as f64 * 50.0) as u32;
                    let _ = app.emit("download-progress", progress);
                }
            }

            drop(app_file);

            #[cfg(target_os = "windows")]
            {
                let _ = Command::new("cmd").args(["/C", "start", ""]).arg(&app_target_path).spawn();

                let _ = app.emit("download-progress", 100);
                std::process::exit(0);
            }
        }
    }

    let _ = app.emit("download-progress", 100);
    Ok(true)
}

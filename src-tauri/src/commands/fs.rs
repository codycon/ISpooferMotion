#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;
use std::process::Command;
use tauri::{AppHandle, Manager};
use tauri_plugin_notification::NotificationExt;

use crate::utils::build_roblox_cookie_header;

#[cfg(target_os = "windows")]
const DETACHED_PROCESS: u32 = 0x00000008;

#[derive(serde::Deserialize)]
pub struct NotificationOptions {
    pub title: Option<String>,
    pub body: Option<String>,
}

#[tauri::command]
pub async fn open_data_folder(app: AppHandle) -> crate::error::Result<bool> {
    let Ok(data_dir) = app.path().app_data_dir() else {
        return Ok(false);
    };

    #[cfg(target_os = "windows")]
    let cmd = Command::new("explorer").arg(data_dir).spawn();
    #[cfg(target_os = "macos")]
    let cmd = Command::new("open").arg(data_dir).spawn();
    #[cfg(target_os = "linux")]
    let cmd = Command::new("xdg-open").arg(data_dir).spawn();

    Ok(cmd.is_ok())
}

#[tauri::command]
pub async fn open_themes_folder(app: AppHandle) -> crate::error::Result<bool> {
    let Ok(data_dir) = app.path().app_data_dir() else {
        return Ok(false);
    };

    let themes_dir = data_dir.join("themes");
    if !themes_dir.exists() {
        let _ = std::fs::create_dir_all(&themes_dir);
    }

    #[cfg(target_os = "windows")]
    let cmd = Command::new("explorer").arg(themes_dir).spawn();
    #[cfg(target_os = "macos")]
    let cmd = Command::new("open").arg(themes_dir).spawn();
    #[cfg(target_os = "linux")]
    let cmd = Command::new("xdg-open").arg(themes_dir).spawn();

    Ok(cmd.is_ok())
}

#[tauri::command]
pub async fn clear_app_cache(app: AppHandle) -> crate::error::Result<bool> {
    if let Ok(cache_dir) = app.path().app_cache_dir() {
        let _ = std::fs::remove_dir_all(&cache_dir);
        let _ = std::fs::create_dir_all(&cache_dir);
    }
    Ok(true)
}

#[tauri::command]
pub async fn play_roblox_audio(
    app: AppHandle,
    asset_id: String,
    cookie: Option<String>,
    enable_cache: Option<bool>,
) -> crate::error::Result<String> {
    let asset_id = asset_id.trim();
    if asset_id.is_empty() || !asset_id.chars().all(|c| c.is_ascii_digit()) {
        return Err("Invalid Roblox audio asset id.".into());
    }

    let cache_enabled = enable_cache.unwrap_or(true);
    let audio_dir = app.path().app_cache_dir()?.join("roblox_audio");
    std::fs::create_dir_all(&audio_dir)?;

    let existing_file = ["ogg", "mp3"]
        .iter()
        .map(|ext| audio_dir.join(format!("sound_{}.{}", asset_id, ext)))
        .find(|path| path.exists());

    let audio_path = if cache_enabled {
        if let Some(path) = existing_file {
            path
        } else {
            download_roblox_audio(&audio_dir, asset_id, cookie.as_deref()).await?
        }
    } else {
        for ext in ["ogg", "mp3"] {
            let _ = std::fs::remove_file(audio_dir.join(format!("sound_{}.{}", asset_id, ext)));
        }
        download_roblox_audio(&audio_dir, asset_id, cookie.as_deref()).await?
    };

    Ok(audio_path.to_string_lossy().into_owned())
}

/// Detect audio format from magic bytes instead of trusting Content-Type headers,
/// which Roblox frequently returns incorrectly.
fn detect_audio_extension(bytes: &[u8]) -> &'static str {
    if bytes.starts_with(b"OggS") {
        "ogg"
    } else if bytes.len() >= 3
        && (bytes.starts_with(b"\xff\xfb")
            || bytes.starts_with(b"\xff\xf3")
            || bytes.starts_with(b"\xff\xf2")
            || bytes.starts_with(b"ID3"))
    {
        "mp3"
    } else if bytes.len() >= 4
        && (bytes[4..].starts_with(b"ftyp")
            || bytes.starts_with(b"\x00\x00\x00"))
    {
        // M4A / MP4 container — browsers support these natively too
        "mp4"
    } else if bytes.starts_with(b"fLaC") {
        "flac"
    } else if bytes.starts_with(b"RIFF") && bytes.len() > 8 && &bytes[8..12] == b"WAVE" {
        "wav"
    } else {
        "ogg" // safe fallback
    }
}

async fn download_roblox_audio(
    audio_dir: &std::path::Path,
    asset_id: &str,
    cookie: Option<&str>,
) -> crate::error::Result<std::path::PathBuf> {
    let client = reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::limited(10))
        .timeout(std::time::Duration::from_secs(30))
        .build()?;

    let mut request = client
        .get(format!("https://assetdelivery.roblox.com/v1/asset/?id={}", asset_id))
        .header(reqwest::header::USER_AGENT, "Roblox/WinInet")
        .header(reqwest::header::ACCEPT, "*/*");

    if let Some(cookie_value) = cookie {
        let cookie_header = build_roblox_cookie_header(cookie_value);
        if !cookie_header.is_empty() {
            request = request.header(reqwest::header::COOKIE, cookie_header);
        }
    }

    let response = request.send().await?;
    if !response.status().is_success() {
        return Err(format!("Roblox audio download failed with HTTP {}.", response.status()).into());
    }

    let bytes = response.bytes().await?;
    if bytes.is_empty() {
        return Err("Roblox returned an empty audio file.".into());
    }

    // Use magic-byte detection — Content-Type from Roblox is frequently wrong
    let extension = detect_audio_extension(&bytes);
    let audio_path = audio_dir.join(format!("sound_{}.{}", asset_id, extension));
    std::fs::write(&audio_path, &bytes)?;
    Ok(audio_path)
}

#[allow(dead_code)]
fn open_file_with_default_app(path: &std::path::Path) -> crate::error::Result<()> {
    #[cfg(target_os = "windows")]
    {
        Command::new("explorer").arg(path).spawn()?;
    }
    #[cfg(target_os = "macos")]
    {
        Command::new("open").arg(path).spawn()?;
    }
    #[cfg(target_os = "linux")]
    {
        Command::new("xdg-open").arg(path).spawn()?;
    }

    Ok(())
}

#[tauri::command]
pub async fn show_notification(
    app: AppHandle,
    options: NotificationOptions,
) -> crate::error::Result<bool> {
    app.notification()
        .builder()
        .title(options.title.as_deref().unwrap_or("ISpooferMotion"))
        .body(options.body.as_deref().unwrap_or("Notification"))
        .icon("app-icon")
        .show()
        .map_err(|err| err.to_string())?;
    Ok(true)
}

#[tauri::command]
pub async fn open_dev_console(app: AppHandle) -> crate::error::Result<bool> {
    let logs_dir = app.path().app_data_dir()?.join("ispoofer_logs");

    let mut entries: Vec<_> = match std::fs::read_dir(&logs_dir) {
        Ok(dir) => dir.filter_map(Result::ok).collect(),
        Err(_) => return Ok(false),
    };

    entries.retain(|e| {
        let name = e.file_name().to_string_lossy().to_string();
        name.starts_with("debug-") && name.ends_with(".txt")
    });
    entries.sort_by_key(|e| e.file_name().to_string_lossy().to_string());

    if let Some(latest) = entries.last() {
        let path = latest.path();

        #[cfg(target_os = "windows")]
        {
            let mut cmd = Command::new("powershell.exe");
            cmd.args(["-NoExit", "-Command", "Get-Content -LiteralPath $args[0] -Wait"]);
            cmd.arg(path.as_os_str());
            cmd.creation_flags(DETACHED_PROCESS);
            let _ = cmd.spawn();
        }

        #[cfg(target_os = "macos")]
        {
            let path_text = path.to_string_lossy();
            let script = format!(
                "tell application \"Terminal\" to do script \"tail -f \\\"{}\\\"\"",
                path_text.replace("\\", "\\\\").replace("\"", "\\\"")
            );
            let mut cmd = Command::new("osascript");
            cmd.args(["-e", &script]);
            let _ = cmd.spawn();
        }

        #[cfg(target_os = "linux")]
        {
            let mut cmd = Command::new("x-terminal-emulator");
            cmd.args(["-e", "tail", "-f"]);
            cmd.arg(path.as_os_str());
            let _ = cmd.spawn();
        }

        Ok(true)
    } else {
        Ok(false)
    }
}

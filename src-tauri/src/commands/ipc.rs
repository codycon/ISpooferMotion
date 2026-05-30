use reqwest::header::{COOKIE, USER_AGENT};
use serde_json::Value;
use std::path::PathBuf;
use std::process::Command;
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_dialog::DialogExt;
use tokio::time::{sleep, Duration};

use crate::utils::build_roblox_cookie_header;

const APP_VERSION: &str = env!("CARGO_PKG_VERSION");

fn get_settings_path(app: &AppHandle) -> crate::error::Result<PathBuf> {
    let dir = app.path().app_data_dir()?;
    Ok(dir.join("renderer-settings.json"))
}

fn get_profile_secrets_path(app: &AppHandle) -> crate::error::Result<PathBuf> {
    let dir = app.path().app_data_dir()?;
    Ok(dir.join("profile-secrets.json"))
}

fn get_jobs_path(app: &AppHandle) -> crate::error::Result<PathBuf> {
    let dir = app.path().app_data_dir()?;
    Ok(dir.join("job-history.json"))
}

async fn read_json_file(path: &PathBuf) -> Value {
    match tokio::fs::read_to_string(path).await {
        Ok(content) => {
            serde_json::from_str(&content).unwrap_or(Value::Object(serde_json::Map::new()))
        }
        Err(_) => Value::Object(serde_json::Map::new()),
    }
}

async fn write_json_file(path: &PathBuf, value: &Value) -> crate::error::Result<()> {
    if let Some(parent) = path.parent() {
        tokio::fs::create_dir_all(parent).await?;
    }
    let json_str = serde_json::to_string_pretty(value)?;
    tokio::fs::write(path, json_str).await.map_err(crate::error::AppError::from)
}

#[tauri::command]
pub fn window_minimize(app: AppHandle) {
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.minimize();
    }
}

#[tauri::command]
pub fn window_close(app: AppHandle) {
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.close();
    }
}

#[tauri::command]
pub fn get_app_version() -> String {
    APP_VERSION.to_string()
}

#[tauri::command]
pub fn get_release_source() -> String {
    "IncrediDev/ISpooferMotion".to_string()
}

#[tauri::command]
pub fn get_runtime_info() -> Value {
    serde_json::json!({
        "appVersion": APP_VERSION,
        "platform": std::env::consts::OS,
        "arch": std::env::consts::ARCH,
        "runtime": "tauri"
    })
}

#[tauri::command]
pub async fn load_renderer_settings(app: AppHandle) -> crate::error::Result<Value> {
    let path = get_settings_path(&app)?;
    Ok(read_json_file(&path).await)
}

#[tauri::command]
pub async fn save_renderer_settings(app: AppHandle, settings: Value) -> crate::error::Result<bool> {
    let path = get_settings_path(&app)?;
    write_json_file(&path, &settings).await?;
    Ok(true)
}

#[tauri::command]
pub async fn load_profile_secrets(app: AppHandle) -> crate::error::Result<Value> {
    let path = get_profile_secrets_path(&app)?;
    Ok(read_json_file(&path).await)
}

#[tauri::command]
pub async fn save_profile_secrets(app: AppHandle, data: Value) -> crate::error::Result<Value> {
    let path = get_profile_secrets_path(&app)?;
    let mut all_secrets = read_json_file(&path).await;

    if let (Some(all_obj), Some(data_obj)) = (all_secrets.as_object_mut(), data.as_object()) {
        for (k, v) in data_obj {
            if k != "action" && k != "secrets" {
                all_obj.insert(k.clone(), v.clone());
            } else if k == "secrets" {
                if let Some(secrets_obj) = v.as_object() {
                    for (sk, sv) in secrets_obj {
                        all_obj.insert(sk.clone(), sv.clone());
                    }
                }
            }
        }
    } else {
        all_secrets = data.clone();
    }

    write_json_file(&path, &all_secrets).await?;
    Ok(all_secrets)
}

#[tauri::command]
pub async fn clear_profile_secrets(
    app: AppHandle,
    _profile_id: Option<String>,
) -> crate::error::Result<bool> {
    let path = get_profile_secrets_path(&app)?;
    write_json_file(&path, &Value::Object(serde_json::Map::new())).await?;
    Ok(true)
}

#[derive(serde::Deserialize)]
pub struct ProfileRequest {
    #[serde(rename = "autoDetect")]
    auto_detect: Option<bool>,
    cookie: Option<String>,
    #[serde(rename = "groupId")]
    group_id: Option<String>,
}

#[tauri::command]
pub async fn get_roblox_profile(context: ProfileRequest) -> crate::error::Result<Value> {
    let auto_detect = context.auto_detect.unwrap_or(false);
    let mut cookie = context.cookie.unwrap_or_default();
    let group_id = context.group_id.map(|s| s.trim().to_string()).filter(|s| !s.is_empty());

    if cookie.is_empty() && auto_detect {
        match crate::commands::auth::get_cookie_from_auto_detect(None).await {
            Ok(Some(c)) => cookie = c,
            _ => return Ok(Value::Null),
        }
    }
    if cookie.is_empty() {
        return Ok(Value::Null);
    }

    let cookie_header = build_roblox_cookie_header(&cookie);
    let client = reqwest::Client::builder().timeout(std::time::Duration::from_secs(15)).build()?;

    let user_resp = client
        .get("https://users.roblox.com/v1/users/authenticated")
        .header(COOKIE, &cookie_header)
        .header(USER_AGENT, "RobloxStudio/WinInet")
        .send()
        .await?;

    if !user_resp.status().is_success() {
        return Ok(Value::Null);
    }

    let user_data: Value = user_resp.json().await?;
    let user_id = user_data.get("id").and_then(serde_json::Value::as_u64);
    let username = user_data
        .get("name")
        .or(user_data.get("displayName"))
        .and_then(|n| n.as_str())
        .unwrap_or("Unknown");

    let Some(user_id) = user_id else {
        return Ok(Value::Null);
    };

    let avatar_resp = client.get(format!(
        "https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds={}&size=150x150&format=Png&isCircular=true",
        user_id
    ))
    .send().await;

    let avatar_url = if let Ok(resp) = avatar_resp {
        let data: Value = resp.json().await.unwrap_or(Value::Null);
        data.get("data")
            .and_then(|d| d.as_array())
            .and_then(|arr| arr.first())
            .and_then(|item| item.get("imageUrl"))
            .and_then(|u| u.as_str())
            .unwrap_or("")
            .to_string()
    } else {
        String::new()
    };

    let mut group_info = Value::Null;
    if let Some(gid) = &group_id {
        if let Ok(g_resp) =
            client.get(format!("https://groups.roblox.com/v1/groups/{}", gid)).send().await
        {
            if let Ok(g_data) = g_resp.json::<Value>().await {
                let g_name = g_data.get("name").and_then(|n| n.as_str()).unwrap_or("Unknown Group");

                let g_icon_url = if let Ok(icon_resp) = client.get(format!(
                    "https://thumbnails.roblox.com/v1/groups/icons?groupIds={}&size=150x150&format=Png&isCircular=true",
                    gid
                )).send().await {
                    let icon_data: Value = icon_resp.json().await.unwrap_or(Value::Null);
                    icon_data.get("data").and_then(|d| d.as_array()).and_then(|arr| arr.first())
                        .and_then(|item| item.get("imageUrl")).and_then(|u| u.as_str())
                        .unwrap_or("").to_string()
                } else {
                    String::new()
                };

                group_info = serde_json::json!({
                    "id": gid,
                    "name": g_name,
                    "iconUrl": g_icon_url
                });
            }
        }
    }

    Ok(serde_json::json!({
        "user": {
            "id": user_id,
            "name": username,
            "avatarUrl": avatar_url
        },
        "group": group_info
    }))
}

#[tauri::command]
pub async fn get_jobs(app: AppHandle) -> crate::error::Result<Value> {
    let path = get_jobs_path(&app)?;
    Ok(read_json_file(&path).await)
}

#[tauri::command]
pub async fn delete_job(app: AppHandle, job_id: String) -> crate::error::Result<bool> {
    let path = get_jobs_path(&app)?;
    let mut jobs = read_json_file(&path).await;
    if let Some(arr) = jobs.as_array_mut() {
        arr.retain(|j| j.get("id").and_then(|id| id.as_str()) != Some(&job_id));
        write_json_file(&path, &jobs).await?;
    }
    Ok(true)
}

#[tauri::command]
pub const fn clear_asset_history() -> bool {
    true
}

#[tauri::command]
pub async fn copy_debug_info(context: Option<Value>) -> crate::error::Result<String> {
    let info = serde_json::json!({
        "appVersion": APP_VERSION,
        "platform": std::env::consts::OS,
        "arch": std::env::consts::ARCH,
        "runtime": "tauri",
        "context": context.unwrap_or(Value::Null)
    });
    serde_json::to_string_pretty(&info).map_err(crate::error::AppError::from)
}

#[tauri::command]
pub async fn export_support_report(
    app: AppHandle,
    context: Option<Value>,
) -> crate::error::Result<String> {
    let dir = app.path().app_data_dir()?;
    let report_path =
        dir.join(format!("support-report-{}.json", chrono::Utc::now().timestamp_millis()));
    let report = serde_json::json!({
        "appVersion": APP_VERSION,
        "platform": std::env::consts::OS,
        "arch": std::env::consts::ARCH,
        "runtime": "tauri",
        "context": context.unwrap_or(Value::Null),
        "createdAt": chrono::Utc::now().to_rfc3339()
    });
    write_json_file(&report_path, &report).await?;
    Ok(report_path.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn open_logs_folder(app: AppHandle) -> crate::error::Result<bool> {
    let logs_dir = app.path().app_data_dir()?.join("ispoofer_logs");
    let _ = std::fs::create_dir_all(&logs_dir);

    #[cfg(target_os = "windows")]
    let result = Command::new("explorer").arg(&logs_dir).spawn();
    #[cfg(target_os = "macos")]
    let result = Command::new("open").arg(&logs_dir).spawn();
    #[cfg(target_os = "linux")]
    let result = Command::new("xdg-open").arg(&logs_dir).spawn();

    Ok(result.is_ok())
}

#[tauri::command]
pub async fn open_plugins_folder(app: AppHandle) -> crate::error::Result<bool> {
    let plugins_dir = app.path().app_data_dir()?.join("plugins");
    let _ = std::fs::create_dir_all(&plugins_dir);

    #[cfg(target_os = "windows")]
    let result = Command::new("explorer").arg(&plugins_dir).spawn();
    #[cfg(target_os = "macos")]
    let result = Command::new("open").arg(&plugins_dir).spawn();
    #[cfg(target_os = "linux")]
    let result = Command::new("xdg-open").arg(&plugins_dir).spawn();

    Ok(result.is_ok())
}

#[tauri::command]
pub async fn clear_plugin_cache() -> crate::error::Result<bool> {
    crate::commands::spoofer::clear_asset_cache();
    Ok(true)
}

#[tauri::command]
pub fn open_external(url: String) -> crate::error::Result<bool> {
    if url.starts_with("https://") || url.starts_with("http://") {
        let _ = open::that(&url);
        Ok(true)
    } else {
        Ok(false)
    }
}

#[tauri::command]
pub async fn select_folder(app: AppHandle) -> crate::error::Result<Option<String>> {
    let folder = tokio::task::spawn_blocking(move || app.dialog().file().blocking_pick_folder())
        .await
        .map_err(|err| err.to_string())?;
    folder
        .map(|path| {
            path.into_path()
                .map(|path| path.to_string_lossy().to_string())
                .map_err(|err| err.to_string().into())
        })
        .transpose()
}

#[tauri::command]
pub async fn uninstall_app(app: AppHandle) -> crate::error::Result<bool> {
    if let Ok(data_dir) = app.path().app_data_dir() {
        let _ = std::fs::remove_dir_all(&data_dir);
    }
    app.exit(0);
    Ok(true)
}

#[tauri::command]
pub async fn fetch_audio_quota(
    cookie: Option<String>,
    auto_detect: Option<bool>,
    context: Option<Value>,
) -> crate::error::Result<Value> {
    let mut cookie_val = cookie.unwrap_or_default();

    if cookie_val.is_empty() {
        if let Some(ctx) = &context {
            cookie_val = ctx.get("cookie").and_then(|c| c.as_str()).unwrap_or("").to_string();
            if cookie_val.is_empty()
                && ctx.get("autoDetect").and_then(serde_json::Value::as_bool).unwrap_or(false)
            {
                match crate::commands::auth::get_cookie_from_auto_detect(None).await {
                    Ok(Some(c)) => cookie_val = c,
                    _ => return Ok(serde_json::json!({"error": "No cookie provided"})),
                }
            }
        }
    }

    if cookie_val.is_empty() && auto_detect.unwrap_or(false) {
        match crate::commands::auth::get_cookie_from_auto_detect(None).await {
            Ok(Some(c)) => cookie_val = c,
            _ => return Ok(serde_json::json!({"error": "No cookie provided"})),
        }
    }

    if cookie_val.is_empty() {
        return Ok(serde_json::json!({"error": "No cookie provided"}));
    }

    let cookie_header = build_roblox_cookie_header(&cookie_val);
    if cookie_header.is_empty() {
        return Ok(serde_json::json!({"error": "Invalid ROBLOSECURITY cookie format"}));
    }

    let client = reqwest::Client::builder().timeout(std::time::Duration::from_secs(15)).build()?;

    let resp = client.get("https://publish.roblox.com/v1/asset-quotas?resourceType=RateLimitUpload&assetType=Audio")
        .header(COOKIE, &cookie_header)
        .header(USER_AGENT, "RobloxStudio/WinInet")
        .send().await?;

    if !resp.status().is_success() {
        return Ok(
            serde_json::json!({"error": format!("Failed to fetch quota: {}", resp.status())}),
        );
    }

    let data: Value = resp.json().await?;
    Ok(data)
}

static SPOOFER_PAUSED: AtomicBool = AtomicBool::new(false);
static SPOOFER_CANCELLED: AtomicBool = AtomicBool::new(false);

async fn wait_if_paused() -> crate::error::Result<()> {
    while SPOOFER_PAUSED.load(Ordering::SeqCst) {
        if SPOOFER_CANCELLED.load(Ordering::SeqCst) {
            return Err("Job cancelled by user".into());
        }
        sleep(Duration::from_millis(500)).await;
    }
    if SPOOFER_CANCELLED.load(Ordering::SeqCst) {
        return Err("Job cancelled by user".into());
    }
    Ok(())
}

fn emit_log(app: &AppHandle, msg: &str, level: &str) {
    let _ = app.emit(
        "spoofer-log",
        serde_json::json!({
            "message": msg,
            "level": level
        }),
    );
}

#[derive(serde::Deserialize)]
pub struct SpooferActionRequest {
    assets: Option<String>,
    cookie: Option<String>,
    #[serde(rename = "apiKey")]
    api_key: Option<String>,
    #[serde(rename = "groupId")]
    group_id: Option<String>,
    #[serde(rename = "spoofSounds")]
    spoof_sounds: Option<bool>,
    #[serde(rename = "downloadOnly")]
    download_only: Option<bool>,
    concurrent: Option<bool>,
}

#[tauri::command]
pub async fn run_spoofer_action(
    app: AppHandle,
    data: SpooferActionRequest,
) -> crate::error::Result<()> {
    SPOOFER_PAUSED.store(false, Ordering::SeqCst);
    SPOOFER_CANCELLED.store(false, Ordering::SeqCst);

    emit_log(&app, "Starting spoofer job...", "info");

    let assets_str = data.assets.unwrap_or_default();
    let cookie = data.cookie.unwrap_or_default();
    let api_key = data.api_key.unwrap_or_default();
    let group_id = data.group_id;
    let spoof_sounds = data.spoof_sounds.unwrap_or(false);
    let download_only = data.download_only.unwrap_or(false);
    let _concurrent = data.concurrent.unwrap_or(false);

    let mut asset_ids = Vec::new();
    let parts: Vec<&str> = assets_str
        .split(|c: char| c.is_whitespace() || c == ',' || c == '[' || c == ']' || c == ';')
        .filter(|s| !s.is_empty())
        .collect();
    for p in parts {
        if let Ok(id) = p.parse::<u64>() {
            asset_ids.push(id.to_string());
        }
    }

    if asset_ids.is_empty() {
        emit_log(&app, "No valid numeric asset IDs found in input.", "error");
        let _ = app.emit(
            "spoofer-result",
            serde_json::json!({"success": false, "output": "No valid IDs"}),
        );
        return Ok(());
    }

    emit_log(&app, &format!("Found {} asset(s) to process.", asset_ids.len()), "info");
    let total = asset_ids.len();

    let mut success_count = 0;
    let mut replacements = serde_json::Map::new();

    for (i, asset_id) in asset_ids.iter().enumerate() {
        if let Err(e) = wait_if_paused().await {
            emit_log(&app, &e.to_string(), "warn");
            break;
        }

        let _ = app.emit(
            "spoofer-progress",
            serde_json::json!({
                "current": i + 1,
                "total": total
            }),
        );

        emit_log(&app, &format!("Processing asset {} ({}/{})", asset_id, i + 1, total), "info");

        let url = format!("https://assetdelivery.roblox.com/v1/asset?id={}", asset_id);
        let downloads_dir = app.path().app_data_dir().unwrap_or_default().join("downloads");
        let _ = tokio::fs::create_dir_all(&downloads_dir).await;
        let file_path = downloads_dir
            .join(format!("{}.{}", asset_id, if spoof_sounds { "ogg" } else { "rbxm" }))
            .to_string_lossy()
            .to_string();

        emit_log(&app, "Downloading asset...", "info");
        let dl_res = crate::commands::spoofer::download_animation_asset_with_progress(
            app.clone(),
            url,
            cookie.clone(),
            file_path.clone(),
            format!("dl_{}", asset_id),
            format!("Asset {}", asset_id),
            asset_id.clone(),
            None,
        )
        .await;

        match dl_res {
            Ok(res) if res.success => {
                emit_log(&app, "Download successful.", "success");

                if download_only {
                    success_count += 1;
                    continue;
                }

                if let Err(e) = wait_if_paused().await {
                    emit_log(&app, &e.to_string(), "warn");
                    break;
                }

                emit_log(&app, "Uploading asset...", "info");
                let up_res = crate::commands::spoofer::publish_asset_with_progress(
                    app.clone(),
                    file_path.clone(),
                    format!("Spoofed {}", asset_id),
                    cookie.clone(),
                    String::new(),
                    group_id.clone(),
                    format!("up_{}", asset_id),
                    if spoof_sounds { Some("Audio".into()) } else { Some("Animation".into()) },
                    Some(api_key.clone()),
                    None,
                    false,
                    Some(asset_id.clone()),
                )
                .await;

                match up_res {
                    Ok(up) if up.success => {
                        let new_id = up.asset_id.unwrap_or_default();
                        emit_log(
                            &app,
                            &format!(
                                "Upload successful! New ID: {}",
                                new_id
                            ),
                            "success",
                        );
                        replacements.insert(asset_id.clone(), serde_json::Value::String(new_id.to_string()));
                        success_count += 1;
                    }
                    Ok(up) => {
                        emit_log(
                            &app,
                            &format!("Upload failed: {}", up.error.unwrap_or_default()),
                            "error",
                        );
                    }
                    Err(e) => {
                        emit_log(&app, &format!("Upload error: {}", e), "error");
                    }
                }
            }
            Ok(res) => emit_log(
                &app,
                &format!("Download failed: {}", res.error.unwrap_or_default()),
                "error",
            ),
            Err(e) => emit_log(&app, &format!("Download error: {}", e), "error"),
        }

        let _ = tokio::fs::remove_file(&file_path).await;
        sleep(Duration::from_millis(1000)).await;
    }

    emit_log(
        &app,
        &format!("Job completed. Successfully processed {}/{} assets.", success_count, total),
        "success",
    );
    let _ = app.emit(
        "spoofer-result",
        serde_json::json!({
            "success": true,
            "replacements": replacements,
            "output": format!("Processed {}/{} assets.", success_count, total)
        }),
    );

    Ok(())
}

#[tauri::command]
pub fn spoofer_pause() {
    SPOOFER_PAUSED.store(true, Ordering::SeqCst);
}

#[tauri::command]
pub fn spoofer_resume() {
    SPOOFER_PAUSED.store(false, Ordering::SeqCst);
}

#[tauri::command]
pub fn spoofer_cancel() {
    SPOOFER_CANCELLED.store(true, Ordering::SeqCst);
}

#[tauri::command]
pub async fn push_to_studio(_replacements_map: Option<Value>) -> crate::error::Result<bool> {
    Ok(false)
}

#[tauri::command]
pub async fn check_session(app: AppHandle) -> crate::error::Result<Value> {
    let result = crate::commands::session::load_session(app).await?;
    Ok(result.unwrap_or(Value::Null))
}

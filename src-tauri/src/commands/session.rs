use serde_json::Value;
use std::fs;
use std::path::PathBuf;
use tauri::AppHandle;
use tauri::Manager;

pub fn get_session_path(app_handle: &AppHandle) -> crate::error::Result<PathBuf> {
    app_handle
        .path()
        .app_data_dir()
        .map(|dir| dir.join("ispoofer_session.json"))
        .map_err(|e| crate::error::AppError::Custom(format!("Failed to get app data dir: {}", e)))
}

#[tauri::command]
pub async fn save_session(app_handle: AppHandle, session: Value) -> crate::error::Result<()> {
    let path = get_session_path(&app_handle)?;
    if let Some(parent) = path.parent() {
        if !parent.exists() {
            let _ = fs::create_dir_all(parent);
        }
    }
    let json_str = serde_json::to_string_pretty(&session)?;
    fs::write(path, json_str)
        .map_err(|e| crate::error::AppError::Custom(format!("Failed to write session file: {}", e)))
}

#[tauri::command]
pub async fn load_session(app_handle: AppHandle) -> crate::error::Result<Option<Value>> {
    let path = get_session_path(&app_handle)?;
    if !path.exists() {
        return Ok(None);
    }
    let content = fs::read_to_string(path).map_err(|e| {
        crate::error::AppError::Custom(format!("Failed to read session file: {}", e))
    })?;
    match serde_json::from_str(&content) {
        Ok(v) => Ok(Some(v)),
        Err(_) => Ok(None),
    }
}

#[tauri::command]
pub async fn clear_session(app_handle: AppHandle) -> crate::error::Result<()> {
    let path = get_session_path(&app_handle)?;
    if path.exists() {
        let _ = fs::remove_file(path);
    }
    Ok(())
}

use crate::utils::{build_roblox_cookie_header, sanitize_filename};
use futures_util::StreamExt;
use reqwest::header::{HeaderMap, HeaderValue, CONTENT_LENGTH, COOKIE, USER_AGENT};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::path::Path;
use std::sync::Mutex;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter};
use tokio::fs::File;
use tokio::io::AsyncWriteExt;

static RL_UNTIL: Mutex<Option<Instant>> = Mutex::new(None);

#[derive(Clone)]
enum UploadAuth {
    ApiKey(String),
    Bearer(String),
}

fn apply_upload_auth(
    builder: reqwest::RequestBuilder,
    auth: &UploadAuth,
) -> reqwest::RequestBuilder {
    match auth {
        UploadAuth::ApiKey(api_key) => builder.header("x-api-key", api_key),
        UploadAuth::Bearer(token) => builder.bearer_auth(token),
    }
}

async fn wait_rate_limit() {
    let wait_dur = {
        if let Ok(guard) = RL_UNTIL.lock() {
            if let Some(until) = *guard {
                let now = Instant::now();
                if until > now {
                    Some(until - now)
                } else {
                    None
                }
            } else {
                None
            }
        } else {
            None
        }
    };
    if let Some(dur) = wait_dur {
        tokio::time::sleep(dur).await;
    }
}

fn set_rate_limit(dur: Duration) {
    if let Ok(mut guard) = RL_UNTIL.lock() {
        *guard = Some(Instant::now() + dur);
    }
}

#[derive(Serialize, Deserialize)]
struct RobloxOperationResponse {
    pub done: Option<bool>,
    pub path: Option<String>,
    pub response: Option<Value>,
    pub error: Option<Value>,
}

#[derive(Serialize, Clone)]
pub struct TransferUpdate {
    pub id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub original_asset_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub status: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub direction: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub progress: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub size: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub new_asset_id: Option<String>,
}

fn emit_transfer_update(app: &AppHandle, payload: TransferUpdate) {
    let _ = app.emit("transfer-update", payload);
}

#[derive(Serialize)]
pub struct DownloadResult {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub file_path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

async fn poll_roblox_operation(
    client: &reqwest::Client,
    op_path: &str,
    auth: &UploadAuth,
) -> Result<String, String> {
    let normalized_path = if op_path.starts_with("assets/") {
        op_path.to_string()
    } else {
        format!("assets/v1/{}", op_path)
    };
    let poll_url = format!("https://apis.roblox.com/{}", normalized_path);

    for _ in 1..=30 {
        tokio::time::sleep(std::time::Duration::from_millis(1000)).await;
        if let Ok(poll_resp) = apply_upload_auth(client.get(&poll_url), auth).send().await {
            if let Ok(poll_data) = poll_resp.json::<RobloxOperationResponse>().await {
                if poll_data.done == Some(true) {
                    if let Some(resp_obj) = poll_data.response {
                        let id = resp_obj.get("assetId").or(resp_obj.get("Id")).and_then(|id| {
                            id.as_str()
                                .map(std::string::ToString::to_string)
                                .or_else(|| id.as_u64().map(|n| n.to_string()))
                        });
                        if let Some(aid) = id {
                            return Ok(aid);
                        }
                    }
                    if let Some(err_obj) = poll_data.error {
                        return Err(format!("Roblox rejected the upload: {:?}", err_obj));
                    }
                }
            }
        }
    }
    Err("Upload timed out waiting for Roblox operation to complete.".into())
}

#[tauri::command]
pub async fn download_animation_asset_with_progress(
    app: AppHandle,
    url: String,
    roblox_cookie: String,
    file_path: String,
    transfer_id: String,
    entry_name: String,
    original_asset_id: String,
    place_id: Option<String>,
) -> crate::error::Result<DownloadResult> {
    let cookie_header = build_roblox_cookie_header(&roblox_cookie);
    if cookie_header.is_empty() {
        emit_transfer_update(
            &app,
            TransferUpdate {
                id: transfer_id.clone(),
                status: Some("error".into()),
                error: Some("Missing or invalid ROBLOSECURITY cookie".into()),
                progress: Some(0),
                name: None,
                original_asset_id: None,
                direction: None,
                size: None,
                new_asset_id: None,
            },
        );
        return Ok(DownloadResult {
            success: false,
            file_path: None,
            error: Some("Missing or invalid ROBLOSECURITY cookie".into()),
        });
    }

    emit_transfer_update(
        &app,
        TransferUpdate {
            id: transfer_id.clone(),
            name: Some(entry_name.clone()),
            original_asset_id: Some(original_asset_id.clone()),
            status: Some("processing".into()),
            direction: Some("download".into()),
            progress: Some(0),
            error: None,
            size: Some(0),
            new_asset_id: None,
        },
    );

    let client = reqwest::Client::builder().timeout(Duration::from_secs(15)).build()?;

    for attempt in 1..=3 {
        let mut headers = HeaderMap::new();
        headers.insert(COOKIE, HeaderValue::from_str(&cookie_header)?);
        if let Some(pid) = &place_id {
            headers.insert("Roblox-Place-Id", HeaderValue::from_str(pid)?);
            headers.insert(USER_AGENT, HeaderValue::from_static("RobloxStudio/WinInet"));
            headers.insert("Roblox-Browser-Asset-Request", HeaderValue::from_static("true"));
        }

        let resp = match client.get(&url).headers(headers).send().await {
            Ok(r) => r,
            Err(e) => {
                let _ = tokio::fs::remove_file(&file_path).await;
                if attempt == 3 {
                    let msg = format!("Download failed: {}", e);
                    emit_transfer_update(
                        &app,
                        TransferUpdate {
                            id: transfer_id.clone(),
                            status: Some("error".into()),
                            error: Some(msg.clone()),
                            progress: Some(0),
                            name: None,
                            original_asset_id: None,
                            direction: None,
                            size: None,
                            new_asset_id: None,
                        },
                    );
                    return Ok(DownloadResult {
                        success: false,
                        file_path: None,
                        error: Some(msg),
                    });
                }
                tokio::time::sleep(Duration::from_millis(2000)).await;
                continue;
            }
        };

        if !resp.status().is_success() {
            let _ = tokio::fs::remove_file(&file_path).await;
            if attempt == 3 {
                let msg = format!("Failed to download asset: {}", resp.status());
                emit_transfer_update(
                    &app,
                    TransferUpdate {
                        id: transfer_id.clone(),
                        status: Some("error".into()),
                        error: Some(msg.clone()),
                        progress: Some(0),
                        name: None,
                        original_asset_id: None,
                        direction: None,
                        size: None,
                        new_asset_id: None,
                    },
                );
                return Ok(DownloadResult { success: false, file_path: None, error: Some(msg) });
            }
            tokio::time::sleep(Duration::from_millis(2000)).await;
            continue;
        }

        let total_size = resp
            .headers()
            .get(CONTENT_LENGTH)
            .and_then(|ct_len| ct_len.to_str().ok())
            .and_then(|ct_len| ct_len.parse().ok())
            .unwrap_or(0);

        emit_transfer_update(
            &app,
            TransferUpdate {
                id: transfer_id.clone(),
                size: Some(total_size),
                name: None,
                original_asset_id: None,
                status: None,
                direction: None,
                progress: None,
                error: None,
                new_asset_id: None,
            },
        );

        let mut file = match File::create(&file_path).await {
            Ok(f) => f,
            Err(e) => return Err(format!("Failed to create file: {}", e).into()),
        };

        let mut stream = resp.bytes_stream();
        let mut downloaded: u64 = 0;
        let mut last_progress = 0;

        while let Some(chunk) = stream.next().await {
            let chunk = match chunk {
                Ok(c) => c,
                Err(e) => {
                    let _ = tokio::fs::remove_file(&file_path).await;
                    if attempt == 3 {
                        return Err(format!("Error while reading stream: {}", e).into());
                    }
                    break;
                }
            };
            if let Err(e) = file.write_all(&chunk).await {
                let _ = tokio::fs::remove_file(&file_path).await;
                return Err(format!("Error writing to file: {}", e).into());
            }
            downloaded += chunk.len() as u64;

            if total_size > 0 {
                let progress = (downloaded as f64 / total_size as f64 * 100.0) as u64;
                if progress > last_progress {
                    emit_transfer_update(
                        &app,
                        TransferUpdate {
                            id: transfer_id.clone(),
                            progress: Some(progress),
                            name: None,
                            original_asset_id: None,
                            status: None,
                            direction: None,
                            error: None,
                            size: None,
                            new_asset_id: None,
                        },
                    );
                    last_progress = progress;
                }
            }
        }

        if downloaded > 0 && downloaded == total_size || total_size == 0 {
            emit_transfer_update(
                &app,
                TransferUpdate {
                    id: transfer_id.clone(),
                    status: Some("completed".into()),
                    progress: Some(100),
                    name: None,
                    original_asset_id: None,
                    direction: None,
                    error: None,
                    size: None,
                    new_asset_id: None,
                },
            );
            return Ok(DownloadResult { success: true, file_path: Some(file_path), error: None });
        }
    }

    Ok(DownloadResult { success: false, file_path: None, error: Some("Download failed.".into()) })
}

#[derive(Serialize)]
pub struct PublishResult {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub asset_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub replaced_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Serialize)]
struct UploadMetadataCreator {
    #[serde(skip_serializing_if = "Option::is_none", rename = "userId")]
    pub user_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "groupId")]
    pub group_id: Option<String>,
}

#[derive(Serialize)]
struct UploadMetadataCreationContext {
    pub creator: UploadMetadataCreator,
}

#[derive(Serialize)]
struct UploadMetadata {
    #[serde(skip_serializing_if = "Option::is_none", rename = "assetType")]
    pub asset_type: Option<String>,
    #[serde(rename = "displayName")]
    pub display_name: String,
    pub description: String,
    #[serde(skip_serializing_if = "Option::is_none", rename = "creationContext")]
    pub creation_context: Option<UploadMetadataCreationContext>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "assetId")]
    pub asset_id: Option<String>,
}

#[tauri::command]
pub async fn publish_asset_with_progress(
    app: AppHandle,
    file_path: String,
    name: String,
    _cookie: String,
    _csrf_token: String,
    group_id: Option<String>,
    transfer_id: String,
    asset_type_name: Option<String>,
    api_key: Option<String>,
    user_id: Option<String>,
    _replace_existing: bool,
    _original_asset_id: Option<String>,
) -> crate::error::Result<PublishResult> {
    let file_buffer = match tokio::fs::read(&file_path).await {
        Ok(b) => b,
        Err(e) => {
            let msg = format!("File system error: {}", e);
            emit_transfer_update(
                &app,
                TransferUpdate {
                    id: transfer_id.clone(),
                    name: Some(name.clone()),
                    status: Some("error".into()),
                    direction: Some("upload".into()),
                    error: Some(msg.clone()),
                    original_asset_id: None,
                    progress: None,
                    size: None,
                    new_asset_id: None,
                },
            );
            return Ok(PublishResult {
                success: false,
                error: Some(msg),
                asset_id: None,
                replaced_id: None,
            });
        }
    };

    emit_transfer_update(
        &app,
        TransferUpdate {
            id: transfer_id.clone(),
            name: Some(name.clone()),
            size: Some(file_buffer.len() as u64),
            status: Some("processing".into()),
            direction: Some("upload".into()),
            progress: Some(0),
            error: None,
            original_asset_id: None,
            new_asset_id: None,
        },
    );

    let is_audio = asset_type_name.as_deref() == Some("Audio");
    let asset_type = if is_audio { "Audio" } else { "Animation" };
    let file_type = if is_audio { "audio/ogg" } else { "model/x-rbxm" };
    let file_name =
        format!("{}.{}", sanitize_filename(&name), if is_audio { "ogg" } else { "rbxm" });

    let current_buffer = file_buffer;

    {
        let upload_auth = match &api_key {
            Some(k) if !k.trim().is_empty() => UploadAuth::ApiKey(k.clone()),
            _ => {
                let oauth_token = if let Some(uid) = &user_id {
                    crate::commands::auth::get_saved_roblox_oauth_access_token(uid.clone())
                        .await
                        .ok()
                        .flatten()
                } else {
                    None
                };

                if let Some(token) = oauth_token {
                    UploadAuth::Bearer(token)
                } else {
                    let msg = "Uploads require an Open Cloud API key or a Roblox OAuth login."
                        .to_string();
                    emit_transfer_update(
                        &app,
                        TransferUpdate {
                            id: transfer_id.clone(),
                            status: Some("error".into()),
                            error: Some(msg.clone()),
                            progress: Some(0),
                            name: None,
                            original_asset_id: None,
                            direction: None,
                            size: None,
                            new_asset_id: None,
                        },
                    );
                    return Ok(PublishResult {
                        success: false,
                        error: Some(msg),
                        asset_id: None,
                        replaced_id: None,
                    });
                }
            }
        };

        let creator = if let Some(gid) = &group_id {
            UploadMetadataCreator { group_id: Some(gid.clone()), user_id: None }
        } else {
            UploadMetadataCreator { user_id: user_id.clone(), group_id: None }
        };

        let request_metadata = UploadMetadata {
            asset_type: Some(asset_type.to_string()),
            display_name: name.clone(),
            description: "Placeholder".to_string(),
            creation_context: Some(UploadMetadataCreationContext { creator }),
            asset_id: None,
        };

        let client = reqwest::Client::new();
        let url = "https://apis.roblox.com/assets/v1/assets";

        let meta_json = serde_json::to_string(&request_metadata)?;

        let mut upload_success = false;
        let mut upload_error = None;
        let mut operation_path = None;
        let mut final_asset_id = None;

        for attempt in 0..=4 {
            wait_rate_limit().await;

            let file_part = reqwest::multipart::Part::bytes(current_buffer.clone())
                .file_name(file_name.clone())
                .mime_str(file_type)?;
            let form = reqwest::multipart::Form::new()
                .text("request", meta_json.clone())
                .part("fileContent", file_part);

            let resp = match apply_upload_auth(client.post(url), &upload_auth)
                .multipart(form)
                .send()
                .await
            {
                Ok(r) => r,
                Err(e) => {
                    upload_error = Some(e.to_string());
                    break;
                }
            };

            let status = resp.status();

            if status.as_u16() == 429 {
                let retry_after = resp
                    .headers()
                    .get("retry-after")
                    .and_then(|v| v.to_str().ok())
                    .and_then(|v| v.parse::<u64>().ok())
                    .unwrap_or(30);
                let jitter = std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .map(|duration| duration.as_millis() as u64)
                    .unwrap_or(0)
                    % 8000;
                set_rate_limit(Duration::from_millis(retry_after * 1000 + jitter));

                if attempt >= 4 {
                    upload_error = Some("Rate limit hit after max retries.".into());
                    break;
                }
                continue;
            }

            let resp_text = resp.text().await.unwrap_or_default();

            if !status.is_success() {
                upload_error = Some(format!("Upload failed ({}): {}", status, resp_text));
                break;
            }

            if let Ok(parsed) = serde_json::from_str::<RobloxOperationResponse>(&resp_text) {
                if parsed.done == Some(true) {
                    if let Some(resp_obj) = parsed.response {
                        let id = resp_obj.get("assetId").or(resp_obj.get("Id")).and_then(|id| {
                            id.as_str()
                                .map(std::string::ToString::to_string)
                                .or_else(|| id.as_u64().map(|n| n.to_string()))
                        });
                        if let Some(aid) = id {
                            final_asset_id = Some(aid);
                            upload_success = true;
                            break;
                        }
                    }
                } else if let Some(path) = parsed.path {
                    operation_path = Some(path);
                    upload_success = true;
                    break;
                }
            } else if let Ok(parsed) = serde_json::from_str::<Value>(&resp_text) {
                let id = parsed
                    .get("response")
                    .and_then(|r| r.get("assetId").or(r.get("Id")))
                    .and_then(|id| {
                        id.as_str()
                            .map(std::string::ToString::to_string)
                            .or_else(|| id.as_u64().map(|n| n.to_string()))
                    });
                if let Some(aid) = id {
                    final_asset_id = Some(aid);
                    upload_success = true;
                    break;
                }
            }

            upload_error = Some("Unexpected response format".into());
            break;
        }

        if !upload_success {
            let msg = upload_error.unwrap_or_else(|| "Unknown upload error".into());
            emit_transfer_update(
                &app,
                TransferUpdate {
                    id: transfer_id.clone(),
                    status: Some("error".into()),
                    error: Some(msg.clone()),
                    progress: Some(0),
                    name: None,
                    original_asset_id: None,
                    direction: None,
                    size: None,
                    new_asset_id: None,
                },
            );
            return Ok(PublishResult {
                success: false,
                error: Some(msg),
                asset_id: None,
                replaced_id: None,
            });
        }

        if let Some(op_path) = operation_path {
            match poll_roblox_operation(&client, &op_path, &upload_auth).await {
                Ok(id) => {
                    final_asset_id = Some(id);
                }
                Err(e) => {
                    let msg = e;
                    emit_transfer_update(
                        &app,
                        TransferUpdate {
                            id: transfer_id.clone(),
                            status: Some("error".into()),
                            error: Some(msg.clone()),
                            progress: Some(0),
                            name: None,
                            original_asset_id: None,
                            direction: None,
                            size: None,
                            new_asset_id: None,
                        },
                    );
                    return Ok(PublishResult {
                        success: false,
                        error: Some(msg),
                        asset_id: None,
                        replaced_id: None,
                    });
                }
            }
        }

        if let Some(id) = final_asset_id {
            emit_transfer_update(
                &app,
                TransferUpdate {
                    id: transfer_id,
                    progress: Some(100),
                    status: Some("completed".into()),
                    new_asset_id: Some(id.clone()),
                    name: None,
                    original_asset_id: None,
                    direction: None,
                    error: None,
                    size: None,
                },
            );
            return Ok(PublishResult {
                success: true,
                asset_id: Some(id),
                replaced_id: None,
                error: None,
            });
        }

        let msg = "Upload returned success but no assetId was found.".to_string();
        emit_transfer_update(
            &app,
            TransferUpdate {
                id: transfer_id.clone(),
                status: Some("error".into()),
                error: Some(msg.clone()),
                progress: Some(0),
                name: None,
                original_asset_id: None,
                direction: None,
                size: None,
                new_asset_id: None,
            },
        );
        Ok(PublishResult { success: false, error: Some(msg), asset_id: None, replaced_id: None })
    }
}

#[tauri::command]
pub async fn get_place_id_from_creator(
    creator_type: String,
    creator_id: String,
    cookie: String,
    max_place_ids: Option<u32>,
) -> crate::error::Result<Vec<String>> {
    let cookie_header = build_roblox_cookie_header(&cookie);
    if cookie_header.is_empty() {
        return Err(crate::error::AppError::Custom(
            "Missing or invalid ROBLOSECURITY cookie".into(),
        ));
    }

    let limit = 50;
    let max_results = max_place_ids.unwrap_or(10).min(100);

    let is_group = creator_type.eq_ignore_ascii_case("group");
    let mut root_places = Vec::new();
    let mut cursor = String::new();
    let client = reqwest::Client::new();

    while root_places.len() < max_results as usize {
        let mut url = if is_group {
            format!("https://games.roblox.com/v2/groups/{}/games?limit={}", creator_id, limit)
        } else {
            format!(
                "https://games.roblox.com/v2/users/{}/games?limit={}&sortOrder=Asc",
                creator_id, limit
            )
        };

        if !cursor.is_empty() {
            url.push_str(&format!("&cursor={}", cursor));
        }

        let resp = client
            .get(&url)
            .header(reqwest::header::COOKIE, &cookie_header)
            .header(reqwest::header::USER_AGENT, "RobloxStudio/WinInet")
            .send()
            .await?;

        if !resp.status().is_success() {
            return Err(crate::error::AppError::Custom(format!(
                "Failed to get games: {}",
                resp.status()
            )));
        }

        let data: serde_json::Value = resp.json().await?;

        let games = data.get("data").and_then(|d| d.as_array()).ok_or_else(|| {
            crate::error::AppError::Custom("Invalid games response format".into())
        })?;
        if games.is_empty() {
            break;
        }

        for game in games {
            let place_id = game
                .get("rootPlace")
                .and_then(|rp| rp.get("id"))
                .or_else(|| game.get("rootPlaceId"))
                .or_else(|| game.get("placeId"))
                .or_else(|| game.get("id"))
                .and_then(|id| {
                    id.as_u64()
                        .map(|n| n.to_string())
                        .or_else(|| id.as_str().map(std::string::ToString::to_string))
                });

            if let Some(pid) = place_id {
                if !root_places.contains(&pid) {
                    root_places.push(pid);
                }
            }
            if root_places.len() >= max_results as usize {
                break;
            }
        }

        if let Some(next_cursor) = data.get("nextPageCursor").and_then(|c| c.as_str()) {
            cursor = next_cursor.to_string();
        } else {
            break;
        }
    }

    if root_places.is_empty() {
        return Err(crate::error::AppError::Custom("No root places found in games".into()));
    }

    Ok(root_places)
}

#[tauri::command]
pub async fn get_multiple_place_ids(
    creator_type: String,
    creator_id: String,
    cookie: String,
    max_place_ids: Option<u32>,
) -> crate::error::Result<Vec<String>> {
    get_place_id_from_creator(creator_type, creator_id, cookie, max_place_ids).await
}

static ASSET_CACHE: std::sync::OnceLock<Mutex<HashMap<String, HashMap<String, String>>>> =
    std::sync::OnceLock::new();

fn get_asset_cache() -> &'static Mutex<HashMap<String, HashMap<String, String>>> {
    ASSET_CACHE.get_or_init(|| Mutex::new(HashMap::new()))
}

#[tauri::command]
pub fn clear_asset_cache() {
    if let Ok(mut cache) = get_asset_cache().lock() {
        cache.clear();
    }
}

#[tauri::command]
pub async fn find_asset_by_name(
    cookie: String,
    asset_type: String,
    name: String,
    group_id: Option<String>,
) -> crate::error::Result<Option<String>> {
    let cookie_header = build_roblox_cookie_header(&cookie);
    if cookie_header.is_empty() {
        return Ok(None);
    }

    let cache_key = format!("{}_{}", asset_type, group_id.as_deref().unwrap_or("user"));
    {
        if let Ok(cache) = get_asset_cache().lock() {
            if let Some(items) = cache.get(&cache_key) {
                if let Some(id) = items.get(&name) {
                    return Ok(Some(id.clone()));
                }
            }
        }
    }

    let mut cursor = String::new();
    let mut base_url = format!("https://itemconfiguration.roblox.com/v1/creations/get-assets?assetType={}&isArchived=false&limit=100", asset_type);
    if let Some(gid) = &group_id {
        base_url.push_str(&format!("&groupId={}", gid));
    }

    let client = reqwest::Client::new();

    loop {
        let mut url = base_url.clone();
        if !cursor.is_empty() {
            url.push_str(&format!("&cursor={}", cursor));
        }

        let resp = client
            .get(&url)
            .header(reqwest::header::COOKIE, &cookie_header)
            .header(reqwest::header::USER_AGENT, "RobloxStudio/WinInet")
            .send()
            .await?;

        if resp.status().as_u16() == 429 {
            tokio::time::sleep(Duration::from_millis(2000)).await;
            continue;
        }
        if !resp.status().is_success() {
            break;
        }

        let data: serde_json::Value = resp.json().await?;
        let items = data.get("data").and_then(|d| d.as_array()).ok_or("Invalid response format")?;

        let mut found = None;
        {
            if let Ok(mut cache) = get_asset_cache().lock() {
                let entry = cache.entry(cache_key.clone()).or_insert_with(HashMap::new);
                for item in items {
                    if let (Some(item_name), Some(asset_id)) = (
                        item.get("name").and_then(|n| n.as_str()),
                        item.get("assetId").and_then(|id| {
                            id.as_u64()
                                .map(|n| n.to_string())
                                .or_else(|| id.as_str().map(std::string::ToString::to_string))
                        }),
                    ) {
                        entry.insert(item_name.to_string(), asset_id.clone());
                        if item_name == name {
                            found = Some(asset_id);
                        }
                    }
                }
            }
        }

        if found.is_some() {
            return Ok(found);
        }

        if let Some(next_cursor) = data.get("nextPageCursor").and_then(|c| c.as_str()) {
            cursor = next_cursor.to_string();
        } else {
            break;
        }
    }

    Ok(None)
}

#[tauri::command]
pub async fn clear_downloads_directory_command(dir_path: String) -> crate::error::Result<bool> {
    crate::utils::clear_downloads_directory(Path::new(&dir_path)).await.map_err(Into::into)
}

use crate::utils::build_roblox_cookie_header;
use reqwest::header::{
    HeaderMap, HeaderValue, ACCEPT, ACCEPT_LANGUAGE, COOKIE, ORIGIN, REFERER, USER_AGENT,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use std::time::Duration;
use tauri::{AppHandle, Emitter};
use tokio::sync::Semaphore;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ResolverAsset {
    #[serde(rename = "assetId")]
    pub asset_id: String,
    pub name: Option<String>,
    pub creator: Option<String>,
    #[serde(rename = "creatorId")]
    pub creator_id: Option<String>,
    #[serde(rename = "creatorType")]
    pub creator_type: Option<String>,
}

#[derive(Serialize, Clone)]
pub struct ResolverProgress {
    pub resolved: usize,
    pub total: usize,
    pub message: String,
    pub asset_id: String,
    pub success: Option<bool>,
}

fn emit_resolver_progress(app: &AppHandle, payload: ResolverProgress) {
    let _ = app.emit("resolver-progress", payload);
}

#[derive(Deserialize, Debug)]
struct RobloxCreatorContext {
    pub creator: Option<RobloxCreatorIds>,
}

#[derive(Deserialize, Debug)]
struct RobloxCreatorIds {
    #[serde(rename = "userId")]
    pub user_id: Option<String>,
    #[serde(rename = "groupId")]
    pub group_id: Option<String>,
}

#[derive(Deserialize, Debug)]
struct RobloxAssetAuthResponse {
    #[serde(rename = "creationContext")]
    pub creation_context: Option<RobloxCreatorContext>,
    #[serde(rename = "displayName")]
    pub display_name: Option<String>,
    pub name: Option<String>,
}

#[tauri::command]
pub async fn resolve_asset_creators(
    app: AppHandle,
    assets: Vec<ResolverAsset>,
    cookie: String,
) -> crate::error::Result<Vec<ResolverAsset>> {
    let cookie_header = build_roblox_cookie_header(&cookie);
    if cookie_header.is_empty() {
        return Err("Missing or invalid ROBLOSECURITY cookie".into());
    }

    let mut needs_resolution = Vec::new();
    let mut resolved_assets = Vec::new();

    for asset in assets {
        if asset.creator.as_deref() == Some("Unknown") || asset.creator.is_none() {
            needs_resolution.push(asset);
        } else {
            resolved_assets.push(asset);
        }
    }

    let total = needs_resolution.len();
    if total == 0 {
        return Ok(resolved_assets);
    }

    let client = reqwest::Client::builder().timeout(Duration::from_secs(10)).build()?;

    let cookie_header_value = HeaderValue::from_str(&cookie_header)?;
    let semaphore = Arc::new(Semaphore::new(8));
    let client = Arc::new(client);
    let cookie_header_value = Arc::new(cookie_header_value);
    let app_arc = Arc::new(app);

    let mut tasks = Vec::new();

    for asset in needs_resolution {
        let sem = Arc::clone(&semaphore);
        let cli = Arc::clone(&client);
        let cookie_value = Arc::clone(&cookie_header_value);
        let app_clone = Arc::clone(&app_arc);

        tasks.push(tokio::spawn(async move {
            let mut resolved_asset = asset.clone();
            let Ok(_permit) = sem.acquire().await else {
                return (resolved_asset, "Resolver concurrency limiter closed".to_string(), false);
            };

            let mut headers = HeaderMap::new();
            headers.insert(COOKIE, (*cookie_value).clone());
            headers.insert("Host", HeaderValue::from_static("apis.roblox.com"));
            headers.insert(USER_AGENT, HeaderValue::from_static("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36"));
            headers.insert(ACCEPT, HeaderValue::from_static("*/*"));
            headers.insert(ACCEPT_LANGUAGE, HeaderValue::from_static("en-US,en;q=0.9"));
            headers.insert(ORIGIN, HeaderValue::from_static("https://create.roblox.com"));
            headers.insert(REFERER, HeaderValue::from_static("https://create.roblox.com/"));

            let url = format!("https://apis.roblox.com/assets/user-auth/v1/assets/{}", asset.asset_id);
            let mut success = false;
            let mut msg = String::new();

            for attempt in 0..3 {
                if attempt > 0 {
                    tokio::time::sleep(Duration::from_secs(5)).await;
                }

                let res = cli.get(&url).headers(headers.clone()).send().await;
                match res {
                    Ok(resp) => {
                        if resp.status().as_u16() == 429 {
                            msg = format!("Rate limited, retrying ({}/3)", attempt + 1);
                            emit_resolver_progress(&app_clone, ResolverProgress {
                                resolved: 0, total: 0, message: msg.clone(), asset_id: asset.asset_id.clone(), success: None
                            });
                            continue;
                        }

                        if resp.status().is_success() {
                            if let Ok(data) = resp.json::<RobloxAssetAuthResponse>().await {
                                if let Some(dn) = data.display_name.or(data.name) {
                                    resolved_asset.name = Some(dn);
                                }

                                if let Some(ctx) = data.creation_context {
                                    if let Some(c) = ctx.creator {
                                        if let Some(uid) = c.user_id {
                                            resolved_asset.creator_id = Some(uid.clone());
                                            resolved_asset.creator_type = Some("User".into());
                                            resolved_asset.creator = Some(uid.clone());
                                            success = true;
                                            msg = format!("Found: User {}", uid);
                                        } else if let Some(gid) = c.group_id {
                                            resolved_asset.creator_id = Some(gid.clone());
                                            resolved_asset.creator_type = Some("Group".into());
                                            resolved_asset.creator = Some(gid.clone());
                                            success = true;
                                            msg = format!("Found: Group {}", gid);
                                        }
                                    }
                                }
                                if !success {
                                    msg = "No creator info in response".to_string();
                                }
                            } else {
                                msg = "Failed to parse API response".to_string();
                            }
                        } else {
                            msg = format!("API returned {}", resp.status());
                        }
                        break;
                    },
                    Err(e) => {
                        msg = format!("Request error: {}", e);
                    }
                }
            }

            (resolved_asset, msg, success)
        }));
    }

    let results = futures_util::future::join_all(tasks).await;
    for (index, (asset, msg, success)) in results.into_iter().flatten().enumerate() {
        emit_resolver_progress(
            &app_arc,
            ResolverProgress {
                resolved: index + 1,
                total,
                message: msg,
                asset_id: asset.asset_id.clone(),
                success: Some(success),
            },
        );
        resolved_assets.push(asset);
    }

    Ok(resolved_assets)
}

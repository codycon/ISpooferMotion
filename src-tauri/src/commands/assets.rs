use reqwest::header::{HeaderMap, HeaderValue, COOKIE, USER_AGENT};
use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Deserialize)]
pub struct FetchAssetsRequest {
    #[serde(rename = "creatorType")]
    pub creator_type: Option<String>,
    #[serde(rename = "creatorId")]
    pub creator_id: String,
    #[serde(rename = "assetTypes")]
    pub asset_types: Option<Vec<String>>,
    pub cookie: String,
    pub limit: Option<u32>,
    #[serde(rename = "maxPages")]
    pub max_pages: Option<u32>,
}

#[derive(Serialize, Clone)]
pub struct AssetExplorerItem {
    pub id: u64,
    pub name: String,
    pub r#type: String,
    pub created: Option<String>,
    pub updated: Option<String>,
    #[serde(rename = "thumbnailUrl")]
    pub thumbnail_url: Option<String>,
    #[serde(rename = "creatorType")]
    pub creator_type: String,
    #[serde(rename = "creatorId")]
    pub creator_id: String,
    #[serde(rename = "isModerated")]
    pub is_moderated: bool,
}

#[derive(Serialize)]
pub struct FetchAssetsResponse {
    pub total: usize,
    pub items: Vec<AssetExplorerItem>,
}

fn map_asset_types(types: Option<Vec<String>>) -> String {
    let mut mapped = Vec::new();
    let default_types = vec![
        "Animation".to_string(),
        "Audio".to_string(),
        "Image".to_string(),
        "Model".to_string(),
    ];
    let input_types = types.unwrap_or(default_types);

    for t in input_types {
        let normalized = match t.as_str() {
            "Images" | "Decal" => "Image",
            other => other,
        };
        if !mapped.contains(&normalized.to_string()) {
            mapped.push(normalized.to_string());
        }
    }
    mapped.join(",")
}

#[tauri::command]
pub async fn fetch_assets(query: FetchAssetsRequest) -> crate::error::Result<FetchAssetsResponse> {
    let creator_type = query.creator_type.unwrap_or_else(|| "User".to_string());
    let is_group = creator_type.eq_ignore_ascii_case("group");
    let limit = query.limit.unwrap_or(50).min(100);
    let max_pages = query.max_pages.unwrap_or(3);
    let asset_types_str = map_asset_types(query.asset_types);

    let client = reqwest::Client::new();
    let mut items = Vec::new();
    let mut cursor: Option<String> = None;
    let mut pages = 0;

    let cookie_header = if query.cookie.starts_with(".ROBLOSECURITY=") {
        query.cookie.clone()
    } else {
        format!(".ROBLOSECURITY={}", query.cookie)
    };

    while pages < max_pages {
        let mut url = if is_group {
            format!(
                "https://inventory.roblox.com/v2/groups/{}/inventory?assetTypes={}&limit={}",
                query.creator_id, asset_types_str, limit
            )
        } else {
            format!(
                "https://inventory.roblox.com/v2/users/{}/inventory?assetTypes={}&limit={}",
                query.creator_id, asset_types_str, limit
            )
        };

        if let Some(c) = &cursor {
            url.push_str(&format!("&cursor={}", c));
        }

        let mut headers = HeaderMap::new();
        headers.insert(COOKIE, HeaderValue::from_str(&cookie_header)?);
        headers.insert(USER_AGENT, HeaderValue::from_static("ISpooferMotion/AssetExplorer"));

        let resp = match client.get(&url).headers(headers).send().await {
            Ok(r) => r,
            Err(e) => return Err(format!("Inventory fetch failed: {}", e).into()),
        };

        if !resp.status().is_success() {
            let status = resp.status();
            let text = resp.text().await.unwrap_or_default();
            return Err(format!("Inventory fetch failed ({}): {}", status, text).into());
        }

        let data: Value = match resp.json().await {
            Ok(d) => d,
            Err(e) => return Err(format!("Failed to parse JSON: {}", e).into()),
        };

        if let Some(page_items) = data.get("data").and_then(|d| d.as_array()) {
            for item in page_items {
                items.push(item.clone());
            }
        }

        cursor = data
            .get("nextPageCursor")
            .and_then(|c| c.as_str())
            .map(std::string::ToString::to_string);
        pages += 1;

        if cursor.is_none() {
            break;
        }
    }

    let mut asset_ids = Vec::new();
    for item in &items {
        if let Some(id) = item.get("assetId").and_then(serde_json::Value::as_u64) {
            if !asset_ids.contains(&id) {
                asset_ids.push(id);
            }
        }
    }

    let mut thumbnails = std::collections::HashMap::new();
    if !asset_ids.is_empty() {
        for chunk in asset_ids.chunks(100) {
            let ids_str = chunk
                .iter()
                .map(std::string::ToString::to_string)
                .collect::<Vec<String>>()
                .join(",");
            let url = format!(
                "https://thumbnails.roblox.com/v1/assets?assetIds={}&size=100x100&format=Png",
                ids_str
            );

            if let Ok(resp) =
                client.get(&url).header(USER_AGENT, "ISpooferMotion/AssetExplorer").send().await
            {
                if let Ok(data) = resp.json::<Value>().await {
                    if let Some(thumb_data) = data.get("data").and_then(|d| d.as_array()) {
                        for t in thumb_data {
                            if let Some(target_id) =
                                t.get("targetId").and_then(serde_json::Value::as_u64)
                            {
                                if let Some(image_url) = t.get("imageUrl").and_then(|u| u.as_str())
                                {
                                    thumbnails.insert(target_id, image_url.to_string());
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    let mut enriched = Vec::new();
    let mut seen_ids = std::collections::HashSet::new();

    for item in items {
        let Some(asset_id) = item.get("assetId").and_then(serde_json::Value::as_u64) else {
            continue;
        };

        if seen_ids.contains(&asset_id) {
            continue;
        }

        let is_moderated =
            item.get("isModerated").and_then(serde_json::Value::as_bool).unwrap_or(false)
                || item.get("moderationStatus").and_then(|s| s.as_str()) == Some("Moderated");

        if is_moderated {
            continue;
        }

        seen_ids.insert(asset_id);

        let name = item
            .get("name")
            .or_else(|| item.get("assetName"))
            .and_then(|n| n.as_str())
            .unwrap_or("Unknown")
            .to_string();

        let r#type = item
            .get("assetType")
            .or_else(|| item.get("type"))
            .and_then(|t| t.as_str())
            .unwrap_or("Unknown")
            .to_string();

        let created =
            item.get("created").and_then(|c| c.as_str()).map(std::string::ToString::to_string);
        let updated =
            item.get("updated").and_then(|u| u.as_str()).map(std::string::ToString::to_string);
        let thumbnail_url = thumbnails.get(&asset_id).cloned();

        enriched.push(AssetExplorerItem {
            id: asset_id,
            name,
            r#type,
            created,
            updated,
            thumbnail_url,
            creator_type: creator_type.clone(),
            creator_id: query.creator_id.clone(),
            is_moderated: false,
        });
    }

    Ok(FetchAssetsResponse { total: enriched.len(), items: enriched })
}

#[tauri::command]
pub async fn fetch_roblox_thumbnail(asset_id: String) -> crate::error::Result<Option<String>> {
    let client = reqwest::Client::new();
    let url = format!(
        "https://thumbnails.roblox.com/v1/assets?assetIds={}&size=420x420&format=Png&isCircular=false",
        asset_id
    );

    let resp = client
        .get(&url)
        .header(USER_AGENT, "ISpooferMotion/AssetExplorer")
        .send()
        .await?;

    if !resp.status().is_success() {
        return Ok(None);
    }

    let data: Value = resp.json().await?;

    if let Some(thumb_data) = data.get("data").and_then(|d| d.as_array()) {
        if let Some(first) = thumb_data.first() {
            if let Some(image_url) = first.get("imageUrl").and_then(|u| u.as_str()) {
                return Ok(Some(image_url.to_string()));
            }
        }
    }

    Ok(None)
}

/// Fetches the raw XML content of a Roblox animation asset (KeyframeSequence)
/// via the asset delivery API, so we can parse keyframes on the frontend.
#[tauri::command]
pub async fn fetch_animation_xml(asset_id: String, cookie: Option<String>) -> crate::error::Result<Option<String>> {
    let url = format!("https://assetdelivery.roblox.com/v1/asset/?id={}", asset_id);

    let client = reqwest::Client::new();
    let mut req = client
        .get(&url)
        .header(USER_AGENT, "ISpooferMotion/AnimPreview");

    if let Some(cookie_val) = cookie {
        let cookie_header = if cookie_val.starts_with(".ROBLOSECURITY=") {
            cookie_val
        } else {
            format!(".ROBLOSECURITY={}", cookie_val)
        };
        req = req.header(COOKIE, cookie_header);
    }

    let resp = req.send().await?;

    if !resp.status().is_success() {
        return Ok(None);
    }

    let bytes = resp.bytes().await?;

    if bytes.starts_with(b"<roblox!") {
        let dom = match rbx_binary::from_reader(bytes.as_ref()) {
            Ok(d) => d,
            Err(e) => return Err(crate::error::AppError::Custom(format!("Binary parse error: {}", e))),
        };
        let mut out = Vec::new();
        if let Err(e) = rbx_xml::to_writer_default(&mut out, &dom, dom.root().children()) {
            return Err(crate::error::AppError::Custom(format!("XML serialize error: {}", e)));
        }
        let xml_str = String::from_utf8_lossy(&out).to_string();
        Ok(Some(xml_str))
    } else if bytes.starts_with(b"<roblox") {
        let xml_str = String::from_utf8_lossy(&bytes).to_string();
        Ok(Some(xml_str))
    } else {
        Ok(None)
    }
}

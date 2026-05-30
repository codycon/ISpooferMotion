use aes_gcm::aead::{Aead, KeyInit};
use aes_gcm::{Aes256Gcm, Key, Nonce};
use base64::engine::general_purpose::{STANDARD, URL_SAFE_NO_PAD};
use base64::Engine;
use keyring::Entry;
use rand::RngCore;
use regex::Regex;
use reqwest::header::{HeaderMap, HeaderValue, COOKIE, USER_AGENT};
use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;
use url::Url;

#[cfg(target_os = "windows")]
use windows_sys::Win32::Foundation::LocalFree;
#[cfg(target_os = "windows")]
use windows_sys::Win32::Security::Credentials::{
    CredFree, CredReadW, CREDENTIALW, CRED_TYPE_GENERIC,
};
#[cfg(target_os = "windows")]
use windows_sys::Win32::Security::Cryptography::{
    CryptUnprotectData, CRYPTPROTECT_UI_FORBIDDEN, CRYPT_INTEGER_BLOB,
};

const ROBLOX_STUDIO_COOKIE_TARGET: &str = "https://www.roblox.com:RobloxStudioAuth.ROBLOSECURITY";
const ROBLOX_USER_AGENT: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
#[cfg(not(target_os = "windows"))]
const BROWSER_COOKIE_SCAN_BYTES: u64 = 25 * 1024 * 1024;

#[derive(Serialize, Deserialize, Debug)]
pub struct AuthResponse {
    pub id: i64,
}

const PROFILE_COOKIE_SERVICE: &str = "ISpooferMotion.RobloxProfileCookie";
const PROFILE_OAUTH_SERVICE: &str = "ISpooferMotion.RobloxOAuthTokens";
const OAUTH_AUTHORIZE_URL: &str = "https://apis.roblox.com/oauth/v1/authorize";
const OAUTH_TOKEN_URL: &str = "https://apis.roblox.com/oauth/v1/token";
const OAUTH_USERINFO_URL: &str = "https://apis.roblox.com/oauth/v1/userinfo";

pub fn extract_roblox_cookie(raw_value: &str) -> Option<String> {
    let re = Regex::new(r#"(?i)_\|WARNING:-DO-NOT-SHARE-THIS\.--Sharing-this-will-allow-someone-to-log-in-as-you-and-to-steal-your-ROBUX-and-items\.\|_[^\s"';,]+"#).ok()?;
    re.find(raw_value).map(|m| m.as_str().to_string())
}

#[cfg(not(target_os = "windows"))]
fn read_possible_cookie_file(path: &Path) -> Option<String> {
    use std::io::Read;
    let file = std::fs::File::open(path).ok()?;
    let mut reader = std::io::BufReader::new(file.take(BROWSER_COOKIE_SCAN_BYTES));
    let mut bytes = Vec::new();
    reader.read_to_end(&mut bytes).ok()?;
    let text = String::from_utf8_lossy(&bytes);
    extract_roblox_cookie(&text)
}

#[cfg(not(target_os = "windows"))]
fn browser_cookie_file_candidates() -> Vec<PathBuf> {
    let home = std::env::var_os("USERPROFILE")
        .or_else(|| std::env::var_os("HOME"))
        .map(PathBuf::from)
        .unwrap_or_default();
    let mut candidates = Vec::new();

    #[cfg(target_os = "macos")]
    {
        let app_support = home.join("Library").join("Application Support");
        let chromium_roots = [
            app_support.join("Google").join("Chrome"),
            app_support.join("Chromium"),
            app_support.join("Microsoft Edge"),
            app_support.join("BraveSoftware").join("Brave-Browser"),
            app_support.join("com.operasoftware.Opera"),
        ];
        let profiles = ["Default", "Profile 1", "Profile 2", "Profile 3"];

        for root in chromium_roots {
            for profile in profiles {
                candidates.push(root.join(profile).join("Network").join("Cookies"));
                candidates.push(root.join(profile).join("Cookies"));
            }
        }

        let firefox_profiles = app_support.join("Firefox").join("Profiles");
        if let Ok(entries) = std::fs::read_dir(firefox_profiles) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_dir() {
                    candidates.push(path.join("cookies.sqlite"));
                }
            }
        }
    }

    #[cfg(target_os = "linux")]
    {
        let config = std::env::var_os("XDG_CONFIG_HOME")
            .map(PathBuf::from)
            .unwrap_or_else(|| home.join(".config"));
        let chromium_roots = [
            config.join("google-chrome"),
            config.join("chromium"),
            config.join("microsoft-edge"),
            config.join("BraveSoftware").join("Brave-Browser"),
            config.join("opera"),
        ];
        let profiles = ["Default", "Profile 1", "Profile 2", "Profile 3"];

        for root in chromium_roots {
            for profile in profiles {
                candidates.push(root.join(profile).join("Network").join("Cookies"));
                candidates.push(root.join(profile).join("Cookies"));
            }
        }

        let firefox_profiles = home.join(".mozilla").join("firefox");
        if let Ok(entries) = std::fs::read_dir(firefox_profiles) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_dir() {
                    candidates.push(path.join("cookies.sqlite"));
                }
            }
        }
    }

    candidates
}

#[cfg(target_os = "windows")]
#[derive(Clone)]
struct ChromiumCookieCandidate {
    cookies_path: PathBuf,
    local_state_path: PathBuf,
}

#[cfg(target_os = "windows")]
fn chromium_cookie_candidates() -> Vec<ChromiumCookieCandidate> {
    let home = std::env::var_os("USERPROFILE")
        .or_else(|| std::env::var_os("HOME"))
        .map(PathBuf::from)
        .unwrap_or_default();
    let local = std::env::var_os("LOCALAPPDATA")
        .map(PathBuf::from)
        .unwrap_or_else(|| home.join("AppData").join("Local"));
    let roaming = std::env::var_os("APPDATA")
        .map(PathBuf::from)
        .unwrap_or_else(|| home.join("AppData").join("Roaming"));

    let roots = [
        local.join("Google").join("Chrome").join("User Data"),
        local.join("Microsoft").join("Edge").join("User Data"),
        local.join("BraveSoftware").join("Brave-Browser").join("User Data"),
        roaming.join("Opera Software").join("Opera Stable"),
        roaming.join("Opera Software").join("Opera GX Stable"),
    ];

    let mut candidates = Vec::new();
    for root in roots {
        let local_state_path = root.join("Local State");
        if !local_state_path.is_file() {
            continue;
        }

        let mut profile_dirs = vec![root.clone()];
        if let Ok(entries) = std::fs::read_dir(&root) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_dir() {
                    profile_dirs.push(path);
                }
            }
        }

        for profile in profile_dirs {
            for cookies_path in [profile.join("Network").join("Cookies"), profile.join("Cookies")] {
                if cookies_path.is_file() {
                    candidates.push(ChromiumCookieCandidate {
                        cookies_path,
                        local_state_path: local_state_path.clone(),
                    });
                }
            }
        }
    }

    candidates
}

#[cfg(target_os = "windows")]
fn decrypt_dpapi(data: &[u8]) -> crate::error::Result<Vec<u8>> {
    unsafe {
        let in_blob =
            CRYPT_INTEGER_BLOB { cbData: data.len() as u32, pbData: data.as_ptr() as *mut u8 };
        let mut out_blob = CRYPT_INTEGER_BLOB { cbData: 0, pbData: std::ptr::null_mut() };
        let ok = CryptUnprotectData(
            &in_blob,
            std::ptr::null_mut(),
            std::ptr::null_mut(),
            std::ptr::null_mut(),
            std::ptr::null_mut(),
            CRYPTPROTECT_UI_FORBIDDEN,
            &mut out_blob,
        );
        if ok == 0 {
            return Err("Windows DPAPI cookie decrypt failed".into());
        }
        let decrypted =
            std::slice::from_raw_parts(out_blob.pbData, out_blob.cbData as usize).to_vec();
        LocalFree(out_blob.pbData as _);
        Ok(decrypted)
    }
}

#[cfg(target_os = "windows")]
fn read_windows_credential_cookie(target: &str) -> Option<String> {
    let mut target_wide = target.encode_utf16().collect::<Vec<_>>();
    target_wide.push(0);

    unsafe {
        let mut credential: *mut CREDENTIALW = std::ptr::null_mut();
        let ok = CredReadW(target_wide.as_ptr(), CRED_TYPE_GENERIC, 0, &mut credential);
        if ok == 0 || credential.is_null() {
            return None;
        }

        let credential_ref = &*credential;
        let bytes = std::slice::from_raw_parts(
            credential_ref.CredentialBlob,
            credential_ref.CredentialBlobSize as usize,
        );
        let utf8 = String::from_utf8_lossy(bytes);
        let cookie = extract_roblox_cookie(&utf8).or_else(|| {
            if bytes.len() % 2 != 0 {
                return None;
            }
            let utf16 = bytes
                .chunks_exact(2)
                .map(|chunk| u16::from_le_bytes([chunk[0], chunk[1]]))
                .collect::<Vec<_>>();
            String::from_utf16(&utf16).ok().and_then(|text| extract_roblox_cookie(&text))
        });

        CredFree(credential as _);
        cookie
    }
}

#[cfg(target_os = "windows")]
fn chromium_master_key(local_state_path: &Path) -> crate::error::Result<Vec<u8>> {
    let text = std::fs::read_to_string(local_state_path)?;
    let parsed: serde_json::Value = serde_json::from_str(&text)?;
    let encrypted_key = parsed
        .get("os_crypt")
        .and_then(|v| v.get("encrypted_key"))
        .and_then(|v| v.as_str())
        .ok_or("Chromium Local State does not contain an encrypted cookie key")?;
    let mut key_bytes = STANDARD.decode(encrypted_key).map_err(|e| {
        crate::error::AppError::Custom(format!("Invalid Chromium cookie key: {}", e))
    })?;
    if key_bytes.starts_with(b"DPAPI") {
        key_bytes.drain(..5);
    }
    decrypt_dpapi(&key_bytes)
}

#[cfg(target_os = "windows")]
fn decrypt_chromium_cookie(encrypted_value: &[u8], master_key: &[u8]) -> Option<String> {
    if encrypted_value.is_empty() {
        return None;
    }

    if encrypted_value.starts_with(b"v10")
        || encrypted_value.starts_with(b"v11")
        || encrypted_value.starts_with(b"v20")
    {
        if encrypted_value.len() <= 15 {
            return None;
        }
        let cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(master_key));
        let nonce = Nonce::from_slice(&encrypted_value[3..15]);
        let plaintext = cipher.decrypt(nonce, &encrypted_value[15..]).ok()?;
        return String::from_utf8(plaintext).ok();
    }

    decrypt_dpapi(encrypted_value).ok().and_then(|bytes| String::from_utf8(bytes).ok())
}

fn copy_cookie_db(path: &Path) -> Option<PathBuf> {
    let temp_path = std::env::temp_dir().join(format!(
        "ispoofermotion-cookies-{}-{}.sqlite",
        std::process::id(),
        SystemTime::now().duration_since(UNIX_EPOCH).ok()?.as_millis()
    ));
    std::fs::copy(path, &temp_path).ok()?;
    Some(temp_path)
}

#[cfg(target_os = "windows")]
fn read_chromium_cookie(candidate: &ChromiumCookieCandidate) -> Option<String> {
    let master_key = chromium_master_key(&candidate.local_state_path).ok()?;
    let temp_db = copy_cookie_db(&candidate.cookies_path)?;
    let conn = Connection::open(&temp_db).ok()?;
    let mut stmt = conn
        .prepare(
            "SELECT value, encrypted_value FROM cookies \
             WHERE host_key LIKE '%roblox.com' AND name = '.ROBLOSECURITY' \
             ORDER BY expires_utc DESC",
        )
        .ok()?;
    let rows = stmt
        .query_map([], |row| {
            let value: String = row.get(0)?;
            let encrypted_value: Vec<u8> = row.get(1)?;
            Ok((value, encrypted_value))
        })
        .ok()?;

    for row in rows.flatten() {
        let (value, encrypted_value) = row;
        if let Some(cookie) = extract_roblox_cookie(&value) {
            let _ = std::fs::remove_file(&temp_db);
            return Some(cookie);
        }
        if let Some(decrypted) = decrypt_chromium_cookie(&encrypted_value, &master_key) {
            if let Some(cookie) = extract_roblox_cookie(&decrypted) {
                let _ = std::fs::remove_file(&temp_db);
                return Some(cookie);
            }
        }
    }

    let _ = std::fs::remove_file(&temp_db);
    None
}

fn firefox_cookie_candidates() -> Vec<PathBuf> {
    let home = std::env::var_os("USERPROFILE")
        .or_else(|| std::env::var_os("HOME"))
        .map(PathBuf::from)
        .unwrap_or_default();
    let profiles = if cfg!(target_os = "windows") {
        std::env::var_os("APPDATA")
            .map(PathBuf::from)
            .unwrap_or_else(|| home.join("AppData").join("Roaming"))
            .join("Mozilla")
            .join("Firefox")
            .join("Profiles")
    } else if cfg!(target_os = "macos") {
        home.join("Library").join("Application Support").join("Firefox").join("Profiles")
    } else {
        home.join(".mozilla").join("firefox")
    };
    let mut candidates = Vec::new();
    if let Ok(entries) = std::fs::read_dir(profiles) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                candidates.push(path.join("cookies.sqlite"));
            }
        }
    }
    candidates
}

fn read_firefox_cookie(path: &Path) -> Option<String> {
    let temp_db = copy_cookie_db(path)?;
    let conn = Connection::open(&temp_db).ok()?;
    let mut stmt = conn
        .prepare(
            "SELECT value FROM moz_cookies \
             WHERE host LIKE '%roblox.com' AND name = '.ROBLOSECURITY' \
             ORDER BY expiry DESC",
        )
        .ok()?;
    let rows = stmt.query_map([], |row| row.get::<_, String>(0)).ok()?;
    for value in rows.flatten() {
        if let Some(cookie) = extract_roblox_cookie(&value) {
            let _ = std::fs::remove_file(&temp_db);
            return Some(cookie);
        }
    }
    let _ = std::fs::remove_file(&temp_db);
    None
}

#[cfg(target_os = "windows")]
fn get_cookie_from_browser_profiles() -> Option<String> {
    chromium_cookie_candidates()
        .iter()
        .find_map(read_chromium_cookie)
        .or_else(|| firefox_cookie_candidates().iter().find_map(|path| read_firefox_cookie(path)))
}

#[cfg(not(target_os = "windows"))]
fn get_cookie_from_browser_profiles() -> Option<String> {
    firefox_cookie_candidates().iter().find_map(|path| read_firefox_cookie(path)).or_else(|| {
        browser_cookie_file_candidates().into_iter().find_map(|path| {
            if path.is_file() {
                read_possible_cookie_file(&path)
            } else {
                None
            }
        })
    })
}

fn get_cookie_from_roblox_studio_inner(
    user_id: Option<String>,
) -> crate::error::Result<Option<String>> {
    #[cfg(target_os = "windows")]
    {
        let output = Command::new("cmdkey").arg("/list").output()?;

        let stdout = String::from_utf8_lossy(&output.stdout);

        let requested_user_id =
            user_id.unwrap_or_default().chars().filter(char::is_ascii_digit).collect::<String>();

        let mut targets: Vec<String> = stdout
            .lines()
            .filter_map(|line| {
                if let Some(idx) = line.find("Target: ") {
                    let target_str = line[idx + 8..].trim();
                    if let Some(target) = target_str.strip_prefix("LegacyGeneric:target=") {
                        return Some(target.to_string());
                    }
                }
                None
            })
            .filter(|target| target.contains(ROBLOX_STUDIO_COOKIE_TARGET))
            .collect();

        targets.sort_by(|a, b| {
            let a_includes_user =
                if !requested_user_id.is_empty() && a.contains(&requested_user_id) { 1 } else { 0 };
            let b_includes_user =
                if !requested_user_id.is_empty() && b.contains(&requested_user_id) { 1 } else { 0 };
            if a_includes_user != b_includes_user {
                return b_includes_user.cmp(&a_includes_user);
            }

            let num_a =
                a.split("ROBLOSECURITY").nth(1).and_then(|s| s.parse::<i64>().ok()).unwrap_or(0);
            let num_b =
                b.split("ROBLOSECURITY").nth(1).and_then(|s| s.parse::<i64>().ok()).unwrap_or(0);
            num_b.cmp(&num_a)
        });

        for target in targets {
            if let Some(cookie) = read_windows_credential_cookie(&target) {
                return Ok(Some(cookie));
            }
        }
        Ok(None)
    }

    #[cfg(target_os = "macos")]
    {
        let home = std::env::var("HOME").unwrap_or_default();
        let cookie_file = std::path::PathBuf::from(home)
            .join("Library/HTTPStorages/com.Roblox.RobloxStudio.binarycookies");

        if let Ok(bytes) = std::fs::read(&cookie_file) {
            let data = String::from_utf8_lossy(&bytes);
            if let Some(cookie) = extract_roblox_cookie(&data) {
                return Ok(Some(cookie));
            }
        }
        return Ok(None);
    }

    #[cfg(target_os = "linux")]
    {
        let home = std::env::var("HOME").unwrap_or_default();
        let possible_paths = vec![
            std::path::PathBuf::from(&home).join(".config/roblox-studio/cookies"),
            std::path::PathBuf::from(&home).join(".local/share/roblox-studio/cookies"),
        ];

        for path in possible_paths {
            if let Ok(bytes) = std::fs::read(&path) {
                let data = String::from_utf8_lossy(&bytes);
                if let Some(cookie) = extract_roblox_cookie(&data) {
                    return Ok(Some(cookie));
                }
            }
        }
        return Ok(None);
    }

    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    {
        Ok(None)
    }
}

#[tauri::command]
pub async fn get_cookie_from_roblox_studio(
    user_id: Option<String>,
) -> crate::error::Result<Option<String>> {
    get_cookie_from_roblox_studio_inner(user_id)
}

#[tauri::command]
pub async fn get_cookie_from_auto_detect(
    user_id: Option<String>,
) -> crate::error::Result<Option<String>> {
    if let Some(cookie) = get_cookie_from_roblox_studio_inner(user_id)? {
        return Ok(Some(cookie));
    }

    Ok(get_cookie_from_browser_profiles())
}

fn profile_cookie_entry(user_id: &str) -> crate::error::Result<Entry> {
    let normalized_user_id = user_id.chars().filter(char::is_ascii_digit).collect::<String>();
    if normalized_user_id.is_empty() {
        return Err(crate::error::AppError::Custom("Missing Roblox user id".into()));
    }

    Entry::new(PROFILE_COOKIE_SERVICE, &normalized_user_id).map_err(|e| {
        crate::error::AppError::Custom(format!("Failed to open credential store: {}", e))
    })
}

#[tauri::command]
pub async fn delete_saved_roblox_profile_cookie(user_id: String) -> crate::error::Result<bool> {
    let entry = profile_cookie_entry(&user_id)?;
    match entry.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(true),
        Err(e) => Err(crate::error::AppError::Custom(format!(
            "Failed to delete saved profile cookie: {}",
            e
        ))),
    }
}

#[derive(Deserialize)]
pub struct RobloxOAuthLoginRequest {
    #[serde(rename = "clientId")]
    client_id: String,
    #[serde(rename = "redirectUri")]
    redirect_uri: String,
    scopes: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct RobloxOAuthTokens {
    access_token: String,
    refresh_token: Option<String>,
    token_type: Option<String>,
    scope: Option<String>,
    id_token: Option<String>,
    expires_at: u64,
    client_id: String,
}

#[derive(Deserialize)]
struct OAuthTokenResponse {
    access_token: String,
    refresh_token: Option<String>,
    token_type: Option<String>,
    scope: Option<String>,
    id_token: Option<String>,
    expires_in: Option<u64>,
}

#[derive(Deserialize)]
struct OAuthUserInfo {
    sub: String,
    name: Option<String>,
    nickname: Option<String>,
    preferred_username: Option<String>,
}

#[derive(Serialize)]
pub struct RobloxOAuthProfile {
    pub id: i64,
    pub name: String,
    #[serde(rename = "displayName")]
    pub display_name: String,
    #[serde(rename = "avatarUrl")]
    pub avatar_url: Option<String>,
    #[serde(rename = "authType")]
    pub auth_type: String,
}

fn now_unix_seconds() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_secs()
}

fn random_url_safe(bytes_len: usize) -> String {
    let mut bytes = vec![0_u8; bytes_len];
    rand::rngs::OsRng.fill_bytes(&mut bytes);
    URL_SAFE_NO_PAD.encode(bytes)
}

fn pkce_challenge(verifier: &str) -> String {
    let digest = Sha256::digest(verifier.as_bytes());
    URL_SAFE_NO_PAD.encode(digest)
}

fn oauth_entry(user_id: &str) -> crate::error::Result<Entry> {
    let normalized_user_id = user_id.chars().filter(char::is_ascii_digit).collect::<String>();
    if normalized_user_id.is_empty() {
        return Err(crate::error::AppError::Custom("Missing Roblox user id".into()));
    }

    Entry::new(PROFILE_OAUTH_SERVICE, &normalized_user_id).map_err(|e| {
        crate::error::AppError::Custom(format!("Failed to open OAuth credential store: {}", e))
    })
}

fn save_oauth_tokens(user_id: &str, tokens: &RobloxOAuthTokens) -> crate::error::Result<()> {
    let entry = oauth_entry(user_id)?;
    let json = serde_json::to_string(tokens)?;
    entry
        .set_password(&json)
        .map_err(|e| crate::error::AppError::Custom(format!("Failed to save OAuth tokens: {}", e)))
}

fn load_oauth_tokens(user_id: &str) -> crate::error::Result<Option<RobloxOAuthTokens>> {
    let entry = oauth_entry(user_id)?;
    match entry.get_password() {
        Ok(json) => serde_json::from_str(&json).map(Some).map_err(|e| {
            crate::error::AppError::Custom(format!("Invalid saved OAuth token: {}", e))
        }),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => {
            Err(crate::error::AppError::Custom(format!("Failed to load OAuth tokens: {}", e)))
        }
    }
}

async fn exchange_oauth_code(
    client: &reqwest::Client,
    client_id: &str,
    redirect_uri: &str,
    code: &str,
    verifier: &str,
) -> crate::error::Result<OAuthTokenResponse> {
    let params = [
        ("grant_type", "authorization_code"),
        ("code", code),
        ("code_verifier", verifier),
        ("client_id", client_id),
        ("redirect_uri", redirect_uri),
    ];

    let response = client.post(OAUTH_TOKEN_URL).form(&params).send().await?;
    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(crate::error::AppError::Custom(format!(
            "OAuth token exchange failed ({}): {}",
            status, body
        )));
    }

    response.json::<OAuthTokenResponse>().await.map_err(Into::into)
}

async fn refresh_oauth_tokens(
    client: &reqwest::Client,
    user_id: &str,
    tokens: &RobloxOAuthTokens,
) -> crate::error::Result<RobloxOAuthTokens> {
    let refresh_token = tokens.refresh_token.clone().ok_or_else(|| {
        crate::error::AppError::Custom("Saved OAuth session has no refresh token".into())
    })?;
    let params = [
        ("grant_type", "refresh_token"),
        ("refresh_token", refresh_token.as_str()),
        ("client_id", tokens.client_id.as_str()),
    ];

    let response = client.post(OAUTH_TOKEN_URL).form(&params).send().await?;
    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(crate::error::AppError::Custom(format!(
            "OAuth refresh failed ({}): {}",
            status, body
        )));
    }

    let refreshed = response.json::<OAuthTokenResponse>().await?;
    let next = RobloxOAuthTokens {
        access_token: refreshed.access_token,
        refresh_token: refreshed.refresh_token.or_else(|| tokens.refresh_token.clone()),
        token_type: refreshed.token_type.or_else(|| tokens.token_type.clone()),
        scope: refreshed.scope.or_else(|| tokens.scope.clone()),
        id_token: refreshed.id_token.or_else(|| tokens.id_token.clone()),
        expires_at: now_unix_seconds() + refreshed.expires_in.unwrap_or(900).saturating_sub(30),
        client_id: tokens.client_id.clone(),
    };
    save_oauth_tokens(user_id, &next)?;
    Ok(next)
}

async fn get_valid_oauth_tokens(user_id: &str) -> crate::error::Result<Option<RobloxOAuthTokens>> {
    let Some(tokens) = load_oauth_tokens(user_id)? else {
        return Ok(None);
    };

    if tokens.expires_at > now_unix_seconds() + 30 {
        return Ok(Some(tokens));
    }

    let client = reqwest::Client::builder().timeout(Duration::from_secs(20)).build()?;
    refresh_oauth_tokens(&client, user_id, &tokens).await.map(Some)
}

async fn fetch_oauth_userinfo(
    client: &reqwest::Client,
    access_token: &str,
) -> crate::error::Result<OAuthUserInfo> {
    let response = client.get(OAUTH_USERINFO_URL).bearer_auth(access_token).send().await?;
    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(crate::error::AppError::Custom(format!(
            "OAuth userinfo failed ({}): {}",
            status, body
        )));
    }
    response.json::<OAuthUserInfo>().await.map_err(Into::into)
}

async fn wait_for_oauth_callback(
    redirect_uri: &Url,
    expected_state: &str,
) -> crate::error::Result<String> {
    let host = redirect_uri
        .host_str()
        .filter(|host| matches!(*host, "127.0.0.1" | "localhost"))
        .ok_or_else(|| {
            crate::error::AppError::Custom(
                "OAuth redirect URI must use http://localhost for the local callback".into(),
            )
        })?;
    if redirect_uri.scheme() != "http" {
        return Err(crate::error::AppError::Custom(
            "OAuth redirect URI must use http for the local callback".into(),
        ));
    }
    let port = redirect_uri.port().ok_or_else(|| {
        crate::error::AppError::Custom("OAuth redirect URI must include a port".into())
    })?;
    let bind_host = if host == "localhost" { "127.0.0.1" } else { host };
    let listener = TcpListener::bind((bind_host, port)).await.map_err(|e| {
        crate::error::AppError::Custom(format!("Failed to start OAuth callback server: {}", e))
    })?;

    let (mut socket, _) =
        tokio::time::timeout(Duration::from_secs(45), listener.accept())
            .await
            .map_err(|_| crate::error::AppError::Custom("OAuth login timed out".into()))??;

    let mut buffer = vec![0_u8; 8192];
    let size = socket.read(&mut buffer).await?;
    let request = String::from_utf8_lossy(&buffer[..size]);
    let first_line = request.lines().next().unwrap_or_default();
    let path = first_line.split_whitespace().nth(1).unwrap_or_default();
    let callback_url = Url::parse(&format!("http://{}:{}{}", host, port, path))
        .map_err(|e| crate::error::AppError::Custom(format!("Invalid OAuth callback: {}", e)))?;

    let mut code = None;
    let mut state = None;
    let mut error = None;
    for (key, value) in callback_url.query_pairs() {
        match key.as_ref() {
            "code" => code = Some(value.into_owned()),
            "state" => state = Some(value.into_owned()),
            "error" => error = Some(value.into_owned()),
            _ => {}
        }
    }

    let (status, body) = if error.is_some() {
        ("400 Bad Request", super::auth_templates::failure_html())
    } else {
        ("200 OK", super::auth_templates::success_html())
    };

    let response = format!(
        "HTTP/1.1 {}\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
        status,
        body.len(),
        body
    );
    let _ = socket.write_all(response.as_bytes()).await;

    if let Some(error) = error {
        return Err(crate::error::AppError::Custom(format!("OAuth login failed: {}", error)));
    }
    if state.as_deref() != Some(expected_state) {
        return Err(crate::error::AppError::Custom("OAuth state mismatch".into()));
    }
    code.ok_or_else(|| {
        crate::error::AppError::Custom("OAuth callback did not include a code".into())
    })
}

#[tauri::command]
pub async fn start_roblox_oauth_login(
    request: RobloxOAuthLoginRequest,
) -> crate::error::Result<RobloxOAuthProfile> {
    let client_id = request.client_id.trim().to_string();
    if client_id.is_empty() {
        return Err(crate::error::AppError::Custom("Missing Roblox OAuth Client ID".into()));
    }
    let redirect_uri = request.redirect_uri.trim().to_string();
    let oauth_redirect_url = Url::parse(&redirect_uri)
        .map_err(|e| crate::error::AppError::Custom(format!("Invalid redirect URI: {}", e)))?;
    let scopes =
        request.scopes.unwrap_or_else(|| "openid profile asset:read asset:write".to_string());
    let verifier = random_url_safe(64);
    let challenge = pkce_challenge(&verifier);
    let state = random_url_safe(32);

    let mut authorize_url = Url::parse(OAUTH_AUTHORIZE_URL)
        .map_err(|e| crate::error::AppError::Custom(format!("Invalid OAuth URL: {}", e)))?;
    authorize_url
        .query_pairs_mut()
        .append_pair("client_id", &client_id)
        .append_pair("redirect_uri", &redirect_uri)
        .append_pair("scope", &scopes)
        .append_pair("response_type", "code")
        .append_pair("state", &state)
        .append_pair("code_challenge", &challenge)
        .append_pair("code_challenge_method", "S256")
        .append_pair("prompt", "consent select_account");

    open::that(authorize_url.as_str()).map_err(|e| {
        crate::error::AppError::Custom(format!("Failed to open Roblox login: {}", e))
    })?;

    let code = wait_for_oauth_callback(&oauth_redirect_url, &state).await?;
    let client = reqwest::Client::builder().timeout(Duration::from_secs(20)).build()?;
    let token_response =
        exchange_oauth_code(&client, &client_id, &redirect_uri, &code, &verifier).await?;
    let expires_at =
        now_unix_seconds() + token_response.expires_in.unwrap_or(900).saturating_sub(30);
    let user_info = fetch_oauth_userinfo(&client, &token_response.access_token).await?;
    let user_id = user_info.sub.clone();
    let tokens = RobloxOAuthTokens {
        access_token: token_response.access_token,
        refresh_token: token_response.refresh_token,
        token_type: token_response.token_type,
        scope: token_response.scope,
        id_token: token_response.id_token,
        expires_at,
        client_id,
    };
    save_oauth_tokens(&user_id, &tokens)?;

    let avatar_url = get_roblox_user_avatar(user_id.clone()).await.ok();
    let display_name = user_info.name.clone().unwrap_or_else(|| {
        user_info
            .preferred_username
            .clone()
            .or(user_info.nickname.clone())
            .unwrap_or_else(|| user_id.clone())
    });
    let name =
        user_info.preferred_username.or(user_info.nickname).unwrap_or_else(|| display_name.clone());

    Ok(RobloxOAuthProfile {
        id: user_id.parse().unwrap_or_default(),
        name,
        display_name,
        avatar_url,
        auth_type: "oauth".into(),
    })
}

#[tauri::command]
pub async fn get_saved_roblox_oauth_access_token(
    user_id: String,
) -> crate::error::Result<Option<String>> {
    Ok(get_valid_oauth_tokens(&user_id).await?.map(|tokens| tokens.access_token))
}

#[tauri::command]
pub async fn get_csrf_token(cookie: String) -> crate::error::Result<String> {
    let url = "https://auth.roblox.com/v2/logout";
    let cookie_header_str = if cookie.starts_with(".ROBLOSECURITY=") {
        cookie.clone()
    } else {
        format!(".ROBLOSECURITY={}", cookie)
    };

    let client = reqwest::Client::builder().timeout(std::time::Duration::from_secs(15)).build()?;

    let mut headers = HeaderMap::new();
    headers.insert(COOKIE, HeaderValue::from_str(&cookie_header_str)?);
    headers.insert(USER_AGENT, HeaderValue::from_static(ROBLOX_USER_AGENT));

    let res = client.post(url).headers(headers).send().await.map_err(|e| {
        crate::error::AppError::Custom(format!("Network error fetching CSRF token: {}", e))
    })?;

    if let Some(token) = res.headers().get("x-csrf-token") {
        Ok(token.to_str().unwrap_or("").to_string())
    } else {
        Err(crate::error::AppError::Custom("No X-CSRF-TOKEN in response header.".to_string()))
    }
}

#[tauri::command]
pub async fn get_authenticated_user_id(cookie: String) -> crate::error::Result<String> {
    let url = "https://users.roblox.com/v1/users/authenticated";
    let cookie_header_str = if cookie.starts_with(".ROBLOSECURITY=") {
        cookie.clone()
    } else {
        format!(".ROBLOSECURITY={}", cookie)
    };

    let client = reqwest::Client::builder().timeout(std::time::Duration::from_secs(15)).build()?;

    let mut headers = HeaderMap::new();
    headers.insert(COOKIE, HeaderValue::from_str(&cookie_header_str)?);
    headers.insert(USER_AGENT, HeaderValue::from_static(ROBLOX_USER_AGENT));

    let res = client
        .get(url)
        .headers(headers)
        .send()
        .await
        .map_err(|e| crate::error::AppError::Custom(format!("Network error: {}", e)))?;

    if !res.status().is_success() {
        return Err(format!("Failed to get authenticated user ID ({})", res.status()).into());
    }
    let data: AuthResponse = res
        .json()
        .await
        .map_err(|e| crate::error::AppError::Custom(format!("Invalid JSON: {}", e)))?;
    Ok(data.id.to_string())
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct RobloxUserInfo {
    pub id: i64,
    pub name: String,
    #[serde(rename = "displayName")]
    pub display_name: String,
}

#[tauri::command]
pub async fn get_roblox_user_info(user_id: String) -> crate::error::Result<RobloxUserInfo> {
    let url = format!("https://users.roblox.com/v1/users/{}", user_id.trim());
    let client = reqwest::Client::builder().timeout(std::time::Duration::from_secs(15)).build()?;
    let res = client
        .get(&url)
        .header("User-Agent", ROBLOX_USER_AGENT)
        .send()
        .await
        .map_err(|e| crate::error::AppError::Custom(format!("Network error: {}", e)))?;

    if !res.status().is_success() {
        return Err(format!("Failed to get user info ({})", res.status()).into());
    }
    let data: RobloxUserInfo = res
        .json()
        .await
        .map_err(|e| crate::error::AppError::Custom(format!("Invalid JSON: {}", e)))?;
    Ok(data)
}

#[tauri::command]
pub async fn get_roblox_user_avatar(user_id: String) -> crate::error::Result<String> {
    let url = format!(
        "https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds={}&size=150x150&format=Png&isCircular=true",
        user_id.trim()
    );
    let client = reqwest::Client::builder().timeout(std::time::Duration::from_secs(15)).build()?;
    let res = client
        .get(&url)
        .header("User-Agent", ROBLOX_USER_AGENT)
        .send()
        .await
        .map_err(|e| crate::error::AppError::Custom(format!("Network error: {}", e)))?;

    if !res.status().is_success() {
        return Err(format!("Failed to get avatar thumbnail ({})", res.status()).into());
    }

    let json: serde_json::Value = res
        .json()
        .await
        .map_err(|e| crate::error::AppError::Custom(format!("Invalid JSON: {}", e)))?;

    let image_url = json["data"]
        .as_array()
        .and_then(|arr| arr.first())
        .and_then(|item| item["imageUrl"].as_str())
        .ok_or_else(|| crate::error::AppError::Custom("No avatar image URL found".to_string()))?
        .to_string();

    Ok(image_url)
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct RobloxGroup {
    pub id: i64,
    pub name: String,
}

#[tauri::command]
pub async fn get_manageable_groups(cookie: String) -> crate::error::Result<Vec<RobloxGroup>> {
    let url = "https://develop.roblox.com/v1/user/groups/canmanage";
    let cookie_header_str = if cookie.starts_with(".ROBLOSECURITY=") {
        cookie.clone()
    } else {
        format!(".ROBLOSECURITY={}", cookie)
    };

    let client = reqwest::Client::builder().timeout(std::time::Duration::from_secs(15)).build()?;

    let mut headers = HeaderMap::new();
    headers.insert(COOKIE, HeaderValue::from_str(&cookie_header_str)?);
    headers.insert(USER_AGENT, HeaderValue::from_static(ROBLOX_USER_AGENT));

    let res = client
        .get(url)
        .headers(headers)
        .send()
        .await
        .map_err(|e| crate::error::AppError::Custom(format!("Network error: {}", e)))?;

    if !res.status().is_success() {
        return Err(format!("Failed to get manageable groups ({})", res.status()).into());
    }

    let json: serde_json::Value = res
        .json()
        .await
        .map_err(|e| crate::error::AppError::Custom(format!("Invalid JSON: {}", e)))?;

    let groups = json["data"]
        .as_array()
        .map(|arr| {
            arr.iter()
                .filter_map(|item| {
                    let id = item["id"].as_i64()?;
                    let name = item["name"].as_str()?.to_string();
                    Some(RobloxGroup { id, name })
                })
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();

    Ok(groups)
}

#[tauri::command]
pub async fn get_group_icon(group_id: String) -> crate::error::Result<String> {
    let url = format!(
        "https://thumbnails.roblox.com/v1/groups/icons?groupIds={}&size=150x150&format=Png&isCircular=true",
        group_id.trim()
    );
    let client = reqwest::Client::builder().timeout(std::time::Duration::from_secs(15)).build()?;
    let res = client
        .get(&url)
        .header("User-Agent", ROBLOX_USER_AGENT)
        .send()
        .await
        .map_err(|e| crate::error::AppError::Custom(format!("Network error: {}", e)))?;

    if !res.status().is_success() {
        return Err(format!("Failed to get group icon ({})", res.status()).into());
    }

    let json: serde_json::Value = res
        .json()
        .await
        .map_err(|e| crate::error::AppError::Custom(format!("Invalid JSON: {}", e)))?;

    let image_url = json["data"]
        .as_array()
        .and_then(|arr| arr.first())
        .and_then(|item| item["imageUrl"].as_str())
        .ok_or_else(|| crate::error::AppError::Custom("No group icon URL found".to_string()))?
        .to_string();

    Ok(image_url)
}

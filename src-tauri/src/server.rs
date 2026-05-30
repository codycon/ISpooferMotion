use axum::{
    extract::{Json, State},
    routing::{get, post},
    Router,
};
use parking_lot::Mutex;
use serde::Serialize;
use serde_json::Value;
use std::net::SocketAddr;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tauri::AppHandle;
use tower_http::cors::{Any, CorsLayer};

#[derive(Clone, Default, Serialize)]
pub struct AssetStore {
    pub assets: Vec<Value>,
    pub scanning: bool,
    pub complete: bool,
    #[serde(skip)]
    pub timestamp: Option<Instant>,
}

#[derive(Default)]
pub struct AssetServerStateData {
    pub request_sounds: bool,
    pub request_animations: bool,
    pub request_images: bool,
    pub request_meshes: bool,
    pub request_script_refs: bool,

    pub last_sounds: AssetStore,
    pub last_animations: AssetStore,
    pub last_images: AssetStore,
    pub last_meshes: AssetStore,
    pub last_script_refs: AssetStore,

    pub stored_mappings: Vec<Value>,
    pub last_plugin_poll_time: Option<Instant>,
    pub skip_owned_check: bool,
}

#[derive(Clone)]
pub struct AppState {
    pub app_handle: AppHandle,
    pub data: Arc<Mutex<AssetServerStateData>>,
}

pub async fn start_server(app_handle: AppHandle) {
    let state_data =
        Arc::new(Mutex::new(AssetServerStateData { skip_owned_check: true, ..Default::default() }));

    let state = AppState { app_handle, data: Arc::clone(&state_data) };

    let cors = CorsLayer::new().allow_origin(Any).allow_methods(Any).allow_headers(Any);

    let app = Router::new()
        .route("/health", get(handle_health))
        .route("/poll", get(handle_poll))
        .route("/poll-sounds", get(handle_poll_sounds))
        .route("/assets-sounds", post(handle_assets_sounds))
        .route("/sounds-complete", post(handle_sounds_complete))
        .route("/poll-animations", get(handle_poll_animations))
        .route("/assets-animations", post(handle_assets_animations))
        .route("/animations-complete", post(handle_animations_complete))
        .route("/poll-images", get(handle_poll_images))
        .route("/assets-images", post(handle_assets_images))
        .route("/images-complete", post(handle_images_complete))
        .route("/assets-meshes", post(handle_assets_meshes))
        .route("/meshes-complete", post(handle_meshes_complete))
        .route("/assets-script-refs", post(handle_assets_script_refs))
        .route("/script-refs-complete", post(handle_script_refs_complete))
        .route("/poll-replacements", get(handle_poll_replacements))
        .route("/replace-ids", post(handle_replace_ids))
        .route("/last-sounds", get(get_last_sounds))
        .route("/last-animations", get(get_last_animations))
        .route("/last-images", get(get_last_images))
        .route("/last-meshes", get(get_last_meshes))
        .route("/last-script-refs", get(get_last_script_refs))
        .route("/request-sounds", post(request_sounds))
        .route("/request-animations", post(request_animations))
        .route("/request-images", post(request_images))
        .route("/request-meshes", post(request_meshes))
        .route("/request-script-refs", post(request_script_refs))
        .layer(cors)
        .with_state(state);

    let addr = SocketAddr::from(([127, 0, 0, 1], 3100));

    tokio::spawn(async move {
        println!("Plugin HTTP server listening on {}", addr);
        if let Ok(listener) = tokio::net::TcpListener::bind(addr).await {
            let _ = axum::serve(listener, app).await;
        }
    });
}

async fn handle_health(State(state): State<AppState>) -> Json<serde_json::Value> {
    let guard = state.data.lock();
    let mut is_connected = false;
    if let Some(last_poll) = guard.last_plugin_poll_time {
        if last_poll.elapsed() < Duration::from_secs(10) {
            is_connected = true;
        }
    }
    Json(serde_json::json!({ "status": "OK", "plugin_connected": is_connected }))
}

fn clear_stale(store: &mut AssetStore) {
    if let Some(ts) = store.timestamp {
        if !store.scanning && !store.complete && ts.elapsed() > Duration::from_secs(60) {
            store.assets.clear();
            store.timestamp = None;
        }
    }
}

fn get_and_reset(store: &mut AssetStore) -> AssetStore {
    clear_stale(store);
    let result = store.clone();
    if store.complete {
        store.assets.clear();
        store.scanning = false;
        store.complete = false;
        store.timestamp = None;
    }
    result
}

async fn get_last_sounds(State(state): State<AppState>) -> Json<AssetStore> {
    let mut guard = state.data.lock();
    Json(get_and_reset(&mut guard.last_sounds))
}

async fn get_last_animations(State(state): State<AppState>) -> Json<AssetStore> {
    let mut guard = state.data.lock();
    Json(get_and_reset(&mut guard.last_animations))
}

async fn get_last_images(State(state): State<AppState>) -> Json<AssetStore> {
    let mut guard = state.data.lock();
    Json(get_and_reset(&mut guard.last_images))
}

async fn get_last_meshes(State(state): State<AppState>) -> Json<AssetStore> {
    let mut guard = state.data.lock();
    Json(get_and_reset(&mut guard.last_meshes))
}

async fn get_last_script_refs(State(state): State<AppState>) -> Json<AssetStore> {
    let mut guard = state.data.lock();
    Json(get_and_reset(&mut guard.last_script_refs))
}

async fn request_sounds(State(state): State<AppState>) -> &'static str {
    let mut guard = state.data.lock();
    guard.request_sounds = true;
    if !guard.last_sounds.scanning {
        guard.last_sounds = AssetStore::default();
    }
    "ok"
}

async fn request_animations(State(state): State<AppState>) -> &'static str {
    let mut guard = state.data.lock();
    guard.request_animations = true;
    if !guard.last_animations.scanning {
        guard.last_animations = AssetStore::default();
    }
    "ok"
}

async fn request_images(State(state): State<AppState>) -> &'static str {
    let mut guard = state.data.lock();
    guard.request_images = true;
    if !guard.last_images.scanning {
        guard.last_images = AssetStore::default();
    }
    "ok"
}

async fn request_meshes(State(state): State<AppState>) -> &'static str {
    let mut guard = state.data.lock();
    guard.request_meshes = true;
    if !guard.last_meshes.scanning {
        guard.last_meshes = AssetStore::default();
    }
    "ok"
}

async fn request_script_refs(State(state): State<AppState>) -> &'static str {
    let mut guard = state.data.lock();
    guard.request_script_refs = true;
    if !guard.last_script_refs.scanning {
        guard.last_script_refs = AssetStore::default();
    }
    "ok"
}

async fn handle_poll(State(state): State<AppState>) -> Json<serde_json::Value> {
    let mut guard = state.data.lock();
    guard.last_plugin_poll_time = Some(Instant::now());
    let req = guard.request_sounds
        || guard.request_animations
        || guard.request_images
        || guard.request_meshes
        || guard.request_script_refs;
    if req {
        guard.request_sounds = false;
        guard.request_animations = false;
        guard.request_images = false;
        guard.request_meshes = false;
        guard.request_script_refs = false;
        guard.last_sounds =
            AssetStore { scanning: true, timestamp: Some(Instant::now()), ..Default::default() };
        guard.last_animations =
            AssetStore { scanning: true, timestamp: Some(Instant::now()), ..Default::default() };
        guard.last_images =
            AssetStore { scanning: true, timestamp: Some(Instant::now()), ..Default::default() };
        guard.last_meshes =
            AssetStore { scanning: true, timestamp: Some(Instant::now()), ..Default::default() };
        guard.last_script_refs =
            AssetStore { scanning: true, timestamp: Some(Instant::now()), ..Default::default() };
    }
    Json(serde_json::json!({ "requestAssets": req }))
}

async fn handle_poll_sounds(State(state): State<AppState>) -> Json<serde_json::Value> {
    let mut guard = state.data.lock();
    guard.last_plugin_poll_time = Some(Instant::now());
    let req = guard.request_sounds;
    if req {
        guard.request_sounds = false;
        guard.last_sounds =
            AssetStore { scanning: true, timestamp: Some(Instant::now()), ..Default::default() };
    }
    Json(serde_json::json!({ "requestAssets": req, "skipOwnedCheck": guard.skip_owned_check }))
}

async fn handle_assets_sounds(
    State(state): State<AppState>,
    Json(payload): Json<Value>,
) -> &'static str {
    let mut guard = state.data.lock();
    if let Some(assets) = payload.get("assets").and_then(|a| a.as_array()) {
        for a in assets {
            guard.last_sounds.assets.push(a.clone());
        }
    }
    "ok"
}

async fn handle_sounds_complete(State(state): State<AppState>) -> &'static str {
    let mut guard = state.data.lock();
    guard.last_sounds.scanning = false;
    guard.last_sounds.complete = true;
    "ok"
}

async fn handle_poll_animations(State(state): State<AppState>) -> Json<serde_json::Value> {
    let mut guard = state.data.lock();
    guard.last_plugin_poll_time = Some(Instant::now());
    let req = guard.request_animations;
    if req {
        guard.request_animations = false;
        guard.last_animations =
            AssetStore { scanning: true, timestamp: Some(Instant::now()), ..Default::default() };
    }
    Json(serde_json::json!({ "requestAssets": req, "skipOwnedCheck": guard.skip_owned_check }))
}

async fn handle_assets_animations(
    State(state): State<AppState>,
    Json(payload): Json<Value>,
) -> &'static str {
    let mut guard = state.data.lock();
    if let Some(assets) = payload.get("assets").and_then(|a| a.as_array()) {
        for a in assets {
            guard.last_animations.assets.push(a.clone());
        }
    }
    "ok"
}

async fn handle_animations_complete(State(state): State<AppState>) -> &'static str {
    let mut guard = state.data.lock();
    guard.last_animations.scanning = false;
    guard.last_animations.complete = true;
    "ok"
}

async fn handle_poll_images(State(state): State<AppState>) -> Json<serde_json::Value> {
    let mut guard = state.data.lock();
    guard.last_plugin_poll_time = Some(Instant::now());
    let req = guard.request_images;
    if req {
        guard.request_images = false;
        guard.last_images =
            AssetStore { scanning: true, timestamp: Some(Instant::now()), ..Default::default() };
    }
    Json(serde_json::json!({ "requestAssets": req, "skipOwnedCheck": guard.skip_owned_check }))
}

async fn handle_assets_images(
    State(state): State<AppState>,
    Json(payload): Json<Value>,
) -> &'static str {
    let mut guard = state.data.lock();
    if let Some(assets) = payload.get("assets").and_then(|a| a.as_array()) {
        for a in assets {
            guard.last_images.assets.push(a.clone());
        }
    }
    "ok"
}

async fn handle_images_complete(State(state): State<AppState>) -> &'static str {
    let mut guard = state.data.lock();
    guard.last_images.scanning = false;
    guard.last_images.complete = true;
    "ok"
}

async fn handle_assets_meshes(
    State(state): State<AppState>,
    Json(payload): Json<Value>,
) -> &'static str {
    let mut guard = state.data.lock();
    if let Some(assets) = payload.get("assets").and_then(|a| a.as_array()) {
        for a in assets {
            guard.last_meshes.assets.push(a.clone());
        }
    }
    "ok"
}

async fn handle_meshes_complete(State(state): State<AppState>) -> &'static str {
    let mut guard = state.data.lock();
    guard.last_meshes.scanning = false;
    guard.last_meshes.complete = true;
    "ok"
}

async fn handle_assets_script_refs(
    State(state): State<AppState>,
    Json(payload): Json<Value>,
) -> &'static str {
    let mut guard = state.data.lock();
    if let Some(assets) = payload.get("assets").and_then(|a| a.as_array()) {
        for a in assets {
            guard.last_script_refs.assets.push(a.clone());
        }
    }
    "ok"
}

async fn handle_script_refs_complete(State(state): State<AppState>) -> &'static str {
    let mut guard = state.data.lock();
    guard.last_script_refs.scanning = false;
    guard.last_script_refs.complete = true;
    "ok"
}

async fn handle_poll_replacements(State(state): State<AppState>) -> Json<serde_json::Value> {
    let mut guard = state.data.lock();
    let mappings = guard.stored_mappings.clone();
    guard.stored_mappings.clear();
    Json(serde_json::json!({ "mappings": mappings }))
}

async fn handle_replace_ids(
    State(state): State<AppState>,
    Json(payload): Json<Value>,
) -> Json<serde_json::Value> {
    let mut guard = state.data.lock();
    if let Some(mappings) = payload.get("mappings").and_then(|a| a.as_array()) {
        guard.stored_mappings = mappings.clone();
    }
    Json(serde_json::json!({ "ok": true }))
}

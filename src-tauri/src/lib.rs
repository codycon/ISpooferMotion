pub mod commands;
pub mod error;
pub mod server;
pub mod utils;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_notification::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default().level(log::LevelFilter::Info).build(),
                )?;
            }

            tauri::async_runtime::spawn(crate::server::start_server(app.handle().clone()));

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::auth::get_cookie_from_roblox_studio,
            commands::auth::get_cookie_from_auto_detect,
            commands::auth::delete_saved_roblox_profile_cookie,
            commands::auth::start_roblox_oauth_login,
            commands::auth::get_saved_roblox_oauth_access_token,
            commands::auth::get_csrf_token,
            commands::auth::get_authenticated_user_id,
            commands::auth::get_roblox_user_info,
            commands::auth::get_roblox_user_avatar,
            commands::auth::get_manageable_groups,
            commands::auth::get_group_icon,
            commands::session::save_session,
            commands::session::load_session,
            commands::session::clear_session,
            commands::spoofer::download_animation_asset_with_progress,
            commands::spoofer::publish_asset_with_progress,
            commands::spoofer::get_place_id_from_creator,
            commands::spoofer::get_multiple_place_ids,
            commands::spoofer::find_asset_by_name,
            commands::spoofer::clear_asset_cache,
            commands::spoofer::clear_downloads_directory_command,
            commands::fs::open_data_folder,
            commands::fs::open_themes_folder,
            commands::fs::clear_app_cache,
            commands::fs::play_roblox_audio,
            commands::fs::show_notification,
            commands::fs::open_dev_console,
            commands::ipc::window_minimize,
            commands::ipc::window_close,
            commands::ipc::get_app_version,
            commands::ipc::get_release_source,
            commands::ipc::get_runtime_info,
            commands::ipc::load_renderer_settings,
            commands::ipc::save_renderer_settings,
            commands::ipc::load_profile_secrets,
            commands::ipc::save_profile_secrets,
            commands::ipc::clear_profile_secrets,
            commands::ipc::get_roblox_profile,
            commands::ipc::get_jobs,
            commands::ipc::delete_job,
            commands::ipc::clear_asset_history,
            commands::ipc::copy_debug_info,
            commands::ipc::export_support_report,
            commands::ipc::open_logs_folder,
            commands::ipc::open_plugins_folder,
            commands::updater::check_for_updates,
            commands::updater::download_and_install_plugin,
            commands::ipc::clear_plugin_cache,
            commands::ipc::open_external,
            commands::ipc::select_folder,
            commands::ipc::uninstall_app,
            commands::ipc::fetch_audio_quota,
            commands::ipc::run_spoofer_action,
            commands::ipc::spoofer_pause,
            commands::ipc::spoofer_resume,
            commands::ipc::spoofer_cancel,
            commands::ipc::push_to_studio,
            commands::ipc::check_session,
            commands::resolver::resolve_asset_creators,
            commands::assets::fetch_assets,
            commands::assets::fetch_roblox_thumbnail,
            commands::assets::fetch_animation_xml,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

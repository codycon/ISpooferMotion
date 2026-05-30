import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

// Helper to handle subscriptions
function subscribe(event: string, callback: any) {
  let unlistenFn: any = null;
  listen(event, (e) => callback(e.payload)).then((fn) => {
    unlistenFn = fn;
  });
  return () => {
    if (unlistenFn) unlistenFn();
  };
}

// Map the old electronAPI to Tauri API
const tauriAPI = {
  minimize: () => invoke('window_minimize'),
  close: () => invoke('window_close'),

  onStatusUpdate: (callback) => subscribe('update-status-message', callback),
  onStatusMessage: (callback) => subscribe('update-status-message', callback),
  onSpooferResult: (callback) => subscribe('spoofer-result', callback),
  onTransferUpdate: (callback) => subscribe('transfer-update', callback),
  onSpooferLog: (callback) => subscribe('spoofer-log', callback),
  onSpooferProgress: (callback) => subscribe('spoofer-progress', callback),
  onScanReceived: (callback) => subscribe('scan-received', callback),

  getAppVersion: () => invoke('get_app_version'),
  pushToStudio: (replacements) => invoke('push_to_studio', { replacements }),
  getReleaseSource: () => invoke('get_release_source'),
  getRuntimeInfo: () => invoke('get_runtime_info'),

  openExternal: (url) => invoke('open_external', { url }),

  loadRendererSettings: () => invoke('load_renderer_settings'),
  saveRendererSettings: (settings) => invoke('save_renderer_settings', { settings }),
  loadProfileSecrets: () => invoke('load_profile_secrets'),
  saveProfileSecrets: (data) => invoke('save_profile_secrets', { data }),
  clearProfileSecrets: (profileId) => invoke('clear_profile_secrets', { profileId }),
  getRobloxProfile: (context) => invoke('get_roblox_profile', { context }),

  runSpooferAction: (data) => invoke('run_spoofer_action', { data }),
  pauseSpoofer: () => invoke('spoofer_pause'),
  resumeSpoofer: () => invoke('spoofer_resume'),
  cancelSpoofer: () => invoke('spoofer_cancel'),
  resumeSession: (data) => invoke('run_spoofer_action', { data: { ...data, resumeSession: true } }),

  getAudioQuota: (context) => invoke('fetch_audio_quota', { context }),
  selectFolder: () => invoke('select_folder'),
  openLogsFolder: () => invoke('open_logs_folder'),
  openPluginsFolder: () => invoke('open_plugins_folder'),
  copyDebugInfo: (context) => invoke('copy_debug_info', { context }),
  exportSupportReport: (context) => invoke('export_support_report', { context }),
  clearCache: () => invoke('clear_asset_history'),
  openDataFolder: () => invoke('open_data_folder'),
  clearAppCache: () => invoke('clear_app_cache'),
  clearPluginCache: () => invoke('clear_plugin_cache'),
  showNotification: (options) => invoke('show_notification', { options }),
  handleRbxlDrop: (files) => invoke('handle_rbxl_drop', { files }),
  handleRbxlExtract: (file, type) => invoke('handle_rbxl_extract', { file, type }),
  openDevConsole: () => invoke('open_dev_console'),
  fetchRobloxThumbnail: (assetId: string) => invoke('fetch_roblox_thumbnail', { assetId }),
  fetchAnimationXml: (assetId: string, cookie?: string) =>
    invoke('fetch_animation_xml', { assetId, cookie: cookie ?? null }),

  checkSession: () => invoke('check_session'),
  uninstallApp: () => invoke('uninstall_app'),
  getJobs: () => invoke('get_jobs'),
  deleteJob: (jobId) => invoke('delete_job', { jobId }),
  clearSession: () => invoke('clear_session'),
};

window.tauriAPI = tauriAPI;

export interface TauriAPI {
  minimize: () => Promise<void>;
  close: () => Promise<void>;

  onStatusUpdate: (callback: (msg: string) => void) => () => void;
  onStatusMessage: (callback: (msg: string) => void) => () => void;
  onSpooferResult: (callback: (result: any) => void) => () => void;
  onTransferUpdate: (callback: (update: any) => void) => () => void;
  onSpooferLog: (callback: (log: { message: string; level: string }) => void) => () => void;
  onSpooferProgress: (
    callback: (progress: { current: number; total: number }) => void,
  ) => () => void;
  onScanReceived: (callback: (data: any) => void) => () => void;

  getAppVersion: () => Promise<string>;
  pushToStudio: (replacements: any) => Promise<boolean>;
  getReleaseSource: () => Promise<string>;
  getRuntimeInfo: () => Promise<any>;

  openExternal: (url: string) => Promise<boolean>;

  loadRendererSettings: () => Promise<any>;
  saveRendererSettings: (settings: any) => Promise<boolean>;
  loadProfileSecrets: () => Promise<any>;
  saveProfileSecrets: (data: any) => Promise<any>;
  clearProfileSecrets: (profileId?: string) => Promise<boolean>;
  getRobloxProfile: (context: any) => Promise<any>;

  runSpooferAction: (data: {
    cookie: string;
    groupId?: string;
    apiKey?: string;
    assets: string;
    spoofSounds?: boolean;
    downloadOnly?: boolean;
    concurrent?: boolean;
  }) => Promise<void>;
  pauseSpoofer: () => Promise<void>;
  resumeSpoofer: () => Promise<void>;
  cancelSpoofer: () => Promise<void>;
  resumeSession: (data: any) => Promise<void>;

  getAudioQuota: (context: any) => Promise<any>;
  selectFolder: () => Promise<string | null>;
  openLogsFolder: () => Promise<boolean>;
  openPluginsFolder: () => Promise<boolean>;
  copyDebugInfo: (context: any) => Promise<string>;
  exportSupportReport: (context: any) => Promise<string>;
  clearCache: () => Promise<boolean>;
  openDataFolder: () => Promise<boolean>;
  clearAppCache: () => Promise<boolean>;
  clearPluginCache: () => Promise<boolean>;
  showNotification: (options: any) => Promise<boolean>;
  handleRbxlDrop: (
    files: string[],
  ) => Promise<{ success: boolean; file?: string; message?: string }>;
  handleRbxlExtract: (
    file: string,
    type: string,
  ) => Promise<{ success: boolean; results?: any[]; message?: string }>;
  openDevConsole: () => Promise<boolean>;
  fetchRobloxThumbnail: (assetId: string) => Promise<string | null>;
  fetchAnimationXml: (assetId: string, cookie?: string) => Promise<string | null>;

  checkSession: () => Promise<any>;
  uninstallApp: () => Promise<boolean>;
  getJobs: () => Promise<any>;
  deleteJob: (jobId: string) => Promise<boolean>;
  clearSession: () => Promise<boolean>;
}

declare global {
  interface Window {
    tauriAPI: TauriAPI;
  }
}

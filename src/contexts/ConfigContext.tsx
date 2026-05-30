import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { loadDevOAuthConfig } from '../utils/oauthConfig';

export interface AppConfig {
  general: {
    autoUpdate: boolean;
    desktopNotifications: boolean;
    hasSeenFirstTimeTutorial: boolean;
  };
  advanced: {
    autoCookieStudio: boolean;
    autoCookieBrowser: boolean;
    skipOwned: boolean;
    pluginPort: string;
    forcePlaceIds: string;
    placeIdSearchLimit: string;
    assetScanTimeout: string;
    excludedUserIds: string;
    excludedGroupIds: string;
  };
  debug: {
    debugMode: boolean;
    enableCache: boolean;
    enableSoundPlayback: boolean;
  };
  spoofing: {
    selectedUser: string;
    selectedGroup: string;
    animation: boolean;
    audio: boolean;
    images: boolean;
    meshes: boolean;
    scriptRefs: boolean;
    videos: boolean;
    cookie: string;
    apiKey: string;
    oauthClientId: string;
    oauthRedirectUri: string;
    useV2OAuth: boolean;
    enableSpoofing: boolean;
    downloadMode: boolean;
    downloadPath: string;
  };
  ui: {
    activeTab: string;
    assetExplorerOpen: boolean;
    homeUpdateSections: string[];
    settingsSections: string[];
    configSections: string[];
    spoofingSections: string[];
    autoScrollSections: boolean;
    quickSettings: string[];
  };
}

const devOAuth = loadDevOAuthConfig();

export const DEFAULT_APP_CONFIG: AppConfig = {
  general: {
    autoUpdate: true,
    desktopNotifications: true,
    hasSeenFirstTimeTutorial: false,
  },
  advanced: {
    autoCookieStudio: true,
    autoCookieBrowser: true,
    skipOwned: true,
    pluginPort: '3100',
    forcePlaceIds: '',
    placeIdSearchLimit: '20',
    assetScanTimeout: '20',
    excludedUserIds: '',
    excludedGroupIds: '',
  },
  debug: {
    debugMode: false,
    enableCache: true,
    enableSoundPlayback: false,
  },
  spoofing: {
    selectedUser: 'none',
    selectedGroup: 'none',
    animation: true,
    audio: true,
    images: true,
    meshes: true,
    scriptRefs: true,
    videos: true,
    cookie: '',
    apiKey: '',

    oauthClientId: devOAuth.clientId,
    oauthRedirectUri: devOAuth.redirectUri,
    useV2OAuth: false,
    enableSpoofing: false,
    downloadMode: false,
    downloadPath: '',
  },
  ui: {
    activeTab: 'home',
    assetExplorerOpen: false,
    homeUpdateSections: ['changelog'],
    settingsSections: ['general', 'debug'],
    configSections: ['credentials', 'routing', 'exclusions'],
    spoofingSections: ['targets', 'execution'],
    autoScrollSections: true,
    quickSettings: ['general.desktopNotifications', 'advanced.skipOwned'],
  },
};

const mergeKnownKeys = <T extends Record<string, unknown>>(
  defaults: T,
  saved: Partial<T> | undefined,
): T => {
  const next = { ...defaults };
  Object.keys(defaults).forEach((key) => {
    if (saved && Object.prototype.hasOwnProperty.call(saved, key)) {
      next[key as keyof T] = saved[key as keyof T] as T[keyof T];
    }
  });
  return next;
};

const mergeSections = (savedSections: unknown, defaultSections: string[]) => {
  if (!Array.isArray(savedSections)) return defaultSections;
  const next = savedSections.filter((section: string) => defaultSections.includes(section));
  return next.length > 0 ? next : defaultSections;
};

interface ConfigContextType {
  config: AppConfig;
  updateConfig: <Category extends keyof AppConfig, Key extends keyof AppConfig[Category]>(
    category: Category,
    key: Key,
    value: AppConfig[Category][Key],
  ) => void;
  updateCategory: <Category extends keyof AppConfig>(
    category: Category,
    values: Partial<AppConfig[Category]>,
  ) => void;

  rootInstances: any[];
  setRootInstances: React.Dispatch<React.SetStateAction<any[]>>;
  loadedFileName: string | null;
  setLoadedFileName: React.Dispatch<React.SetStateAction<string | null>>;
  parsingFileName: string | null;
  setParsingFileName: React.Dispatch<React.SetStateAction<string | null>>;
  selectedAssetIds: Set<string>;
  setSelectedAssetIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  applyReplacements: (replacements: Record<string, string>) => void;
}

const ConfigContext = createContext<ConfigContextType | undefined>(undefined);

export const ConfigProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [config, setConfig] = useState<AppConfig>(() => {
    const saved = localStorage.getItem('ISpooferMotion_Config');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const nextConfig = {
          general: mergeKnownKeys(DEFAULT_APP_CONFIG.general, parsed.general),
          advanced: mergeKnownKeys(DEFAULT_APP_CONFIG.advanced, parsed.advanced),
          debug: mergeKnownKeys(DEFAULT_APP_CONFIG.debug, parsed.debug),
          spoofing: mergeKnownKeys(DEFAULT_APP_CONFIG.spoofing, parsed.spoofing),
          ui: {
            ...mergeKnownKeys(DEFAULT_APP_CONFIG.ui, parsed.ui),
            settingsSections: mergeSections(
              parsed.ui?.settingsSections,
              DEFAULT_APP_CONFIG.ui.settingsSections,
            ),
            configSections: mergeSections(
              parsed.ui?.configSections,
              DEFAULT_APP_CONFIG.ui.configSections,
            ),
            spoofingSections: mergeSections(
              parsed.ui?.spoofingSections,
              DEFAULT_APP_CONFIG.ui.spoofingSections,
            ),
          },
        };
        if (nextConfig.spoofing.oauthRedirectUri === 'http://127.0.0.1:43110/oauth/callback') {
          nextConfig.spoofing.oauthRedirectUri = DEFAULT_APP_CONFIG.spoofing.oauthRedirectUri;
        }
        if (devOAuth.clientId && !nextConfig.spoofing.oauthClientId) {
          nextConfig.spoofing.oauthClientId = devOAuth.clientId;
          nextConfig.spoofing.oauthRedirectUri = devOAuth.redirectUri;
        }
        return nextConfig;
      } catch (e) {
        console.error('Failed to parse config from localStorage', e);
      }
    }
    return DEFAULT_APP_CONFIG;
  });

  useEffect(() => {
    localStorage.setItem('ISpooferMotion_Config', JSON.stringify(config));
  }, [config]);

  const updateConfig = useCallback(
    <Category extends keyof AppConfig, Key extends keyof AppConfig[Category]>(
      category: Category,
      key: Key,
      value: AppConfig[Category][Key],
    ) => {
      setConfig((prev) => ({
        ...prev,
        [category]: {
          ...prev[category],
          [key]: value,
        },
      }));
    },
    [],
  );

  const updateCategory = useCallback(
    <Category extends keyof AppConfig>(
      category: Category,
      values: Partial<AppConfig[Category]>,
    ) => {
      setConfig((prev) => ({
        ...prev,
        [category]: {
          ...prev[category],
          ...values,
        },
      }));
    },
    [],
  );

  const [rootInstances, setRootInstances] = useState<any[]>([]);
  const [loadedFileName, setLoadedFileName] = useState<string | null>(null);
  const [parsingFileName, setParsingFileName] = useState<string | null>(null);
  const [selectedAssetIds, setSelectedAssetIds] = useState<Set<string>>(new Set());
  // Trigger Vite HMR

  const applyReplacements = useCallback((replacements: Record<string, string>) => {
    setRootInstances((prev) => {
      const walk = (nodes: any[]): any[] => {
        return nodes.map((node) => {
          const newAssets = node.assets.map((asset: any) => {
            let currentId = asset.assetId || asset.id || '';
            if (currentId && replacements[currentId]) {
              return { ...asset, assetId: replacements[currentId], id: replacements[currentId] };
            }
            return asset;
          });
          return {
            ...node,
            assets: newAssets,
            children: walk(node.children || []),
          };
        });
      };
      return walk(prev);
    });

    setSelectedAssetIds((prev) => {
      const next = new Set<string>();
      prev.forEach((id) => {
        next.add(replacements[id] ? replacements[id] : id);
      });
      return next;
    });
  }, []);

  return (
    <ConfigContext.Provider
      value={{
        config,
        updateConfig,
        updateCategory,
        rootInstances,
        setRootInstances,
        loadedFileName,
        setLoadedFileName,
        parsingFileName,
        setParsingFileName,
        selectedAssetIds,
        setSelectedAssetIds,
        applyReplacements,
      }}
    >
      {children}
    </ConfigContext.Provider>
  );
};

export const useConfig = () => {
  const context = useContext(ConfigContext);
  if (context === undefined) {
    throw new Error('useConfig must be used within a ConfigProvider');
  }
  return context;
};

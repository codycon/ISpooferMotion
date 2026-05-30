import { invoke } from '@tauri-apps/api/core';
import { appDataDir, join } from '@tauri-apps/api/path';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { exists, mkdir, writeTextFile } from '@tauri-apps/plugin-fs';
import { AnimatePresence, motion } from 'framer-motion';
import { FolderOpen, Globe, Settings2, SlidersHorizontal, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { HexAlphaColorPicker } from 'react-colorful';
import { createPortal } from 'react-dom';
import { useConfig } from '../../contexts/ConfigContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { useThemeAccent } from '../../contexts/ThemeContext';
import { Accordion, AccordionItem } from '../../ism-library';
import { logIsm } from '../../utils/robloxProfiles';

import {
  Button,
  FormColorPickerRow,
  FormDropdown,
  FormToggle,
  Group,
  itemVariants,
  pageVariants,
  Row,
  Window,
} from '../../ism-library';
import { AVAILABLE_QUICK_SETTINGS } from '../layout/QuickSettingsMenu';

const DEFAULT_THEME_JSON = `{
  "name": "default",
  "background": {
    "image": "",
    "video": ""
  },
  "colors": {
    "background": "#09090b",
    "foreground": "#eeedf2",
    "content1": "#111113",
    "content2": "#18181b",
    "content3": "#27272a",
    "border": "#3f3f46",
    "primary": "#10b981",
    "secondary": "#a1a1aa",
    "success": "#4ade80",
    "warning": "#fbbf24",
    "danger": "#f87171",
    "default": "#3f3f46"
  },
  "style": {
    "border_radius": "10px",
    "blur": "8px",
    "app_opacity": "1",
    "shadow": "0 20px 64px rgba(0, 0, 0, 0.72), 0 8px 20px rgba(0, 0, 0, 0.4)"
  }
}`;

export default function SettingsView() {
  const { t, lang, setLang } = useLanguage();
  const { accentColor, setAccentColor, themeMode, setThemeMode } = useThemeAccent();
  const { config, updateConfig } = useConfig();
  const [localAccent, setLocalAccent] = useState(accentColor);
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
  const [pickerCoords, setPickerCoords] = useState({ top: 0, left: 0 });

  const langOptions = { en: '🇬🇧 English', es: '🇪🇸 Español', ru: '🇷🇺 Русский', fr: '🇫🇷 Français' };

  const handleOpenThemeEditor = async () => {
    try {
      const existing = await WebviewWindow.getByLabel('theme-editor');
      if (existing) {
        await existing.show();
        await existing.setFocus().catch(() => null);
        return;
      }

      const editor = new WebviewWindow('theme-editor', {
        url: '/theme-editor.html',
        title: 'Theme Editor',
        width: 760,
        height: 660,
        minWidth: 720,
        minHeight: 560,
        center: true,
        visible: true,
        decorations: true,
        transparent: false,
      });
      editor.once('tauri://created', () => {
        editor.show().catch(() => null);
        editor.setFocus().catch(() => null);
      });
      editor.once('tauri://error', (event) => {
        window.ismLog?.('error', `Theme Editor failed to open: ${String(event.payload)}`);
      });
    } catch (err) {
      console.error('Failed to open theme editor:', err);
      window.ismLog?.('error', `Theme Editor failed to open: ${String(err)}`);
    }
  };
  const langDropdownOptions = Object.entries(langOptions).map(([value, label]) => ({
    value,
    label,
  }));

  useEffect(() => {
    async function initThemes() {
      try {
        const baseDir = await appDataDir();
        const themesDir = await join(baseDir, 'themes');
        if (!(await exists(themesDir))) {
          await mkdir(themesDir, { recursive: true });
        }
        const defaultPath = await join(themesDir, 'default.json');
        if (!(await exists(defaultPath))) {
          await writeTextFile(defaultPath, DEFAULT_THEME_JSON);
        }
      } catch (err) {
        console.error('Failed to init default theme:', err);
      }
    }
    initThemes();
  }, []);

  useEffect(() => {
    setLocalAccent(accentColor);
  }, [accentColor]);

  useEffect(() => {
    if (!isColorPickerOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsColorPickerOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isColorPickerOpen]);

  const handleColorChange = useCallback(
    (hex: string) => {
      setLocalAccent(hex);
      setAccentColor(hex);
    },
    [setAccentColor],
  );

  async function handleClearCache(successMessage = 'Cache cleared.') {
    try {
      await Promise.allSettled([
        invoke('clear_asset_cache'),
        invoke('clear_plugin_cache'),
        invoke('clear_app_cache'),
      ]);

      Object.keys(localStorage).forEach((key) => {
        if (
          key.startsWith('ISpooferMotion_DetectedGroups_') ||
          key === 'theme_editor_draft' ||
          key === 'ISpooferMotion_AssetExplorerState'
        ) {
          localStorage.removeItem(key);
        }
      });
      sessionStorage.clear();
      logIsm('success', successMessage);
    } catch (err) {
      logIsm('error', `Failed to clear cache: ${String(err)}`);
    }
  }

  const handleDesktopNotificationsChange = async (enabled: boolean) => {
    updateConfig('general', 'desktopNotifications', enabled);
    if (!enabled) {
      logIsm('info', 'Desktop notifications disabled.');
      return;
    }

    try {
      const shown = await invoke<boolean>('show_notification', {
        options: {
          title: 'ISpooferMotion',
          body: 'Desktop notifications are enabled.',
        },
      });
      logIsm(
        shown ? 'success' : 'warn',
        shown ? 'Desktop notifications enabled.' : 'Desktop notifications could not be shown.',
      );
    } catch (err) {
      logIsm('error', `Desktop notifications failed: ${String(err)}`);
    }
  };

  const handleCacheChange = async (enabled: boolean) => {
    updateConfig('debug', 'enableCache', enabled);
    if (enabled) {
      logIsm('success', 'Cache enabled.');
      return;
    }

    await handleClearCache('Cache disabled. Cached runtime data cleared.');
  };


  const handleAutoScrollChange = (enabled: boolean) => {
    updateConfig('ui', 'autoScrollSections', enabled);
    if (enabled) {
      logIsm('warn', 'This is an experimental feature, do not expect it to work correctly.');
      logIsm('success', 'Auto scroll enabled.');
    } else {
      logIsm('info', 'Auto scroll disabled.');
    }
  };

  return (
    <motion.div
      variants={pageVariants}
      initial="hidden"
      animate="show"
      exit="exit"
      className="w-full h-full tour-settings-page"
    >
      <Window>
        <motion.div variants={itemVariants} className="w-full flex flex-col gap-8">
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-bold text-text-primary tracking-tight">
              {t('settings.title')}
            </h1>
            <p className="text-sm text-text-muted font-medium">{t('settings.subtitle')}</p>
          </div>
          <Accordion
            selectionMode="multiple"
            expandedKeys={config.ui.settingsSections}
            onExpandedChange={(keys) => updateConfig('ui', 'settingsSections', keys)}
            className="flex flex-col gap-6"
          >
            <AccordionItem
              value="general"
              aria-label={t('settings.general')}
              title={
                <span className="flex items-center gap-3 font-semibold">
                  <Globe size={18} className="text-primary" /> {t('settings.general')}
                </span>
              }
              className="tour-settings-general"
            >
              <Group>
                <FormToggle
                  label={t('settings.autoUpdate')}
                  checked={config.general.autoUpdate}
                  onChange={(v) => updateConfig('general', 'autoUpdate', v)}
                />
                <FormToggle
                  label={t('settings.desktopNotifications')}
                  checked={config.general.desktopNotifications}
                  onChange={handleDesktopNotificationsChange}
                />
                <FormDropdown
                  label={t('settings.language')}
                  options={langDropdownOptions}
                  value={lang}
                  onChange={setLang}
                  width="w-[140px]"
                />

                <div className="flex items-center justify-between w-full">
                  <span className="text-sm font-medium text-text-primary">
                    {t('settings.theme')}
                  </span>
                  <div className="flex bg-bg-surface border border-border-subtle rounded-[calc(var(--radius-md)-2px)] p-1 overflow-hidden w-[200px] shrink-0">
                    {(['light', 'dark', 'custom'] as const).map((tMode) => (
                      <button
                        key={tMode}
                        onClick={() => {
                          setThemeMode(tMode);
                          if (tMode === 'custom') {
                            handleOpenThemeEditor();
                          } else {
                            WebviewWindow.getByLabel('theme-editor').then((win) => win?.hide());
                          }
                        }}
                        className={`flex-1 py-1.5 text-xs font-medium rounded-[calc(var(--radius-md)-4px)] transition-all ${
                          themeMode === tMode
                            ? 'bg-text-primary text-bg-base shadow-sm'
                            : 'text-text-secondary hover:text-text-primary hover:bg-bg-elevated'
                        }`}
                      >
                        {t(`settings.theme${tMode.charAt(0).toUpperCase() + tMode.slice(1)}`)}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="relative">
                  <FormColorPickerRow
                    label={t('settings.accentColor')}
                    color={accentColor}
                    onClick={(e: any) => {
                      e.stopPropagation();
                      const rect = e.currentTarget.getBoundingClientRect();
                      setPickerCoords({ top: rect.bottom + 8, left: rect.right - 200 });
                      setIsColorPickerOpen((prev) => !prev);
                    }}
                  />
                  {createPortal(
                    <AnimatePresence>
                      {isColorPickerOpen && (
                        <div className="fixed inset-0 z-[9999] pointer-events-none">
                          <div
                            className="absolute inset-0 z-[490] pointer-events-auto"
                            onClick={(e) => {
                              e.stopPropagation();
                              setIsColorPickerOpen(false);
                            }}
                          />
                          <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: -10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: -10 }}
                            className="absolute z-[500] p-0 border border-border-subtle rounded-xl overflow-hidden shadow-floating bg-bg-surface flex flex-col pointer-events-auto"
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={(e) => e.stopPropagation()}
                            style={{
                              top: pickerCoords.top,
                              left: pickerCoords.left,
                            }}
                          >
                            <HexAlphaColorPicker color={localAccent} onChange={handleColorChange} />
                            <div className="p-3 border-t border-border-subtle flex items-center justify-between bg-bg-elevated">
                              <span className="text-xs font-bold text-text-muted">HEX</span>
                              <input
                                type="text"
                                value={localAccent.toUpperCase()}
                                onChange={(e) => handleColorChange(e.target.value)}
                                className="bg-bg-base text-text-primary text-xs font-mono px-2 py-1 rounded w-20 text-center border border-border-strong outline-none focus:border-primary transition-colors"
                              />
                            </div>
                          </motion.div>
                        </div>
                      )}
                    </AnimatePresence>,
                    document.body,
                  )}
                </div>
              </Group>
            </AccordionItem>

            <AccordionItem
              value="quickSettings"
              aria-label="Quick Settings"
              title={
                <span className="flex items-center gap-3 font-semibold">
                  <SlidersHorizontal size={18} className="text-primary" /> Quick Settings
                </span>
              }
              className="tour-settings-quick-settings"
            >
              <Group>
                <div className="text-sm text-text-muted mb-3 font-medium px-5">
                  Select which settings you want to appear in the Quick Settings menu located in the
                  top bar.
                </div>
                <div className="flex flex-col gap-0 pb-2">
                  {Object.entries(
                    AVAILABLE_QUICK_SETTINGS.reduce(
                      (acc, setting) => {
                        const groupKey = `${setting.page} > ${setting.section}`;
                        if (!acc[groupKey]) acc[groupKey] = [];
                        acc[groupKey].push(setting);
                        return acc;
                      },
                      {} as Record<string, typeof AVAILABLE_QUICK_SETTINGS>,
                    ),
                  ).map(([groupKey, settings]) => (
                    <Group key={groupKey} title={groupKey} className="!pt-2">
                      <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                        {settings.map((setting) => (
                          <FormToggle
                            key={setting.id}
                            label={setting.label}
                            checked={config.ui.quickSettings.includes(setting.id)}
                            onChange={(checked) => {
                              const newSettings = checked
                                ? [...config.ui.quickSettings, setting.id]
                                : config.ui.quickSettings.filter((id) => id !== setting.id);
                              updateConfig('ui', 'quickSettings', newSettings);
                            }}
                          />
                        ))}
                      </div>
                    </Group>
                  ))}
                </div>
              </Group>
            </AccordionItem>

            <AccordionItem
              value="debug"
              aria-label="Debug & Display"
              title={
                <span className="flex items-center gap-3 font-semibold">
                  <Settings2 size={18} className="text-primary" /> Debug & Display
                </span>
              }
              className="tour-settings-debug"
            >
              <Group>
                <Row>
                  <FormToggle
                    label={t('settings.debugMode')}
                    checked={config.debug.debugMode}
                    onChange={(v) => updateConfig('debug', 'debugMode', v)}
                  />
                  <FormToggle
                    label={t('settings.enableCache')}
                    checked={config.debug.enableCache}
                    onChange={handleCacheChange}
                  />
                </Row>
                <Row>

                  <FormToggle
                    label={
                      <span className="flex items-center gap-2">
                        Auto Scroll Sections
                        <span className="text-[10px] font-bold text-red-500 bg-red-500/10 px-1.5 py-0.5 rounded uppercase tracking-wider">
                          Experimental
                        </span>
                      </span>
                    }
                    checked={config.ui.autoScrollSections}
                    onChange={handleAutoScrollChange}
                  />
                </Row>
                <div className="mt-2 w-full flex gap-2">
                  <Button
                    label={t('settings.clearCache')}
                    variant="bordered"
                    fullWidth={true}
                    startContent={<Trash2 size={16} />}
                    onClick={() => handleClearCache()}
                  />
                  <Button
                    label="Open Logs Folder"
                    variant="bordered"
                    fullWidth={true}
                    startContent={<FolderOpen size={16} />}
                    onClick={() =>
                      invoke('open_logs_folder').catch((err) =>
                        logIsm('error', `Failed to open logs folder: ${err}`),
                      )
                    }
                  />
                </div>
              </Group>
            </AccordionItem>
          </Accordion>
        </motion.div>
      </Window>
    </motion.div>
  );
}

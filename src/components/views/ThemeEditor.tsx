import { convertFileSrc, invoke } from '@tauri-apps/api/core';
import { emit } from '@tauri-apps/api/event';
import { appDataDir, join } from '@tauri-apps/api/path';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { exists, mkdir, readDir, readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';
import { motion } from 'framer-motion';
import {
  Check,
  Code,
  FolderOpen,
  FolderSearch,
  Image as ImageIcon,
  Redo2,
  Save,
  Undo2,
  Upload,
  Video,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { ThemeConfig, useThemeAccent } from '../../contexts/ThemeContext';
import { useThemeHistory } from '../../hooks/useThemeHistory';
import { Accordion, AccordionItem, Button, Dropdown, Group, Row, Window } from '../../ism-library';
import InlineColorPicker from './theme-editor/InlineColorPicker';
import {
  BLUR_PRESETS,
  DEFAULT_THEME_JSON,
  DEFAULT_THEME_OBJ,
  isTauriRuntime,
  percentLabel,
  RADIUS_PRESETS,
  rangeStyle,
  SHADOW_PRESETS,
} from './theme-editor/themeEditorConfig';

export default function ThemeEditor() {
  const { loadThemeFromJson } = useThemeAccent();
  const [expandedKeys, setExpandedKeys] = useState<string[]>([
    'core',
    'surfaces',
    'styling',
    'media',
  ]);
  const [savedThemes, setSavedThemes] = useState<string[]>([]);
  const [activeThemeName, setActiveThemeName] = useState<string>('');

  const { currentTheme, pushState, undo, redo, canUndo, canRedo } =
    useThemeHistory(DEFAULT_THEME_OBJ);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showJsonMode, setShowJsonMode] = useState(false);

  const loadSavedThemes = async () => {
    if (!isTauriRuntime()) {
      setSavedThemes(['default.json']);
      return;
    }

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
      const entries = await readDir(themesDir);
      const themeFiles = entries.filter((e) => e.name?.endsWith('.json')).map((e) => e.name!);
      setSavedThemes(themeFiles);
    } catch (err) {
      console.error('Failed to load themes dir', err);
    }
  };

  useEffect(() => {
    loadSavedThemes();
    const draft = localStorage.getItem('theme_editor_draft');
    if (draft) {
      try {
        const parsed = JSON.parse(draft);
        if (parsed && typeof parsed === 'object') {
          const merged: ThemeConfig = {
            ...DEFAULT_THEME_OBJ,
            ...parsed,
            colors: { ...DEFAULT_THEME_OBJ.colors, ...(parsed.colors || {}) },
            style: { ...DEFAULT_THEME_OBJ.style, ...(parsed.style || {}) },
            background: { ...DEFAULT_THEME_OBJ.background, ...(parsed.background || {}) },
          };
          pushState(merged);
        } else {
          pushState(DEFAULT_THEME_OBJ);
        }
      } catch (e) {
        console.warn('Failed to parse theme draft, using defaults', e);
        pushState(DEFAULT_THEME_OBJ);
      }
    } else {
      pushState(DEFAULT_THEME_OBJ);
    }
  }, []);

  useEffect(() => {
    const handler = setTimeout(() => {
      if (!currentTheme) return;
      const jsonStr = JSON.stringify(currentTheme, null, 2);
      localStorage.setItem('theme_editor_draft', jsonStr);
      loadThemeFromJson(jsonStr);
    }, 50);
    return () => clearTimeout(handler);
  }, [currentTheme]);

  const updateColor = (key: string, value: string) => {
    pushState({
      ...currentTheme,
      colors: { ...currentTheme.colors, [key]: value },
    });
  };

  const updateStyle = (key: string, value: string) => {
    pushState({
      ...currentTheme,
      style: { ...currentTheme.style, [key]: value },
    });
  };

  const updateBackground = (key: 'image' | 'video', value: string) => {
    pushState({
      ...currentTheme,
      background: { ...currentTheme.background, [key]: value },
    });
  };

  const updateLogo = (key: 'image' | 'opacity', value: string) => {
    pushState({
      ...currentTheme,
      logo: { ...currentTheme.logo, [key]: value },
    });
  };

  const updateName = (value: string) => {
    pushState({ ...currentTheme, name: value });
  };

  const handleApplyGlobal = async () => {
    const jsonStr = JSON.stringify(currentTheme, null, 2);
    if (isTauriRuntime()) {
      await emit('theme-updated', jsonStr);
    } else {
      loadThemeFromJson(jsonStr);
      localStorage.setItem('theme', 'custom');
    }
    setSuccess(true);
    setTimeout(() => setSuccess(false), 2000);
  };

  const handleSaveToManager = async () => {
    try {
      const name = currentTheme.name || 'Untitled_Theme';
      const filename = name.replace(/[^a-z0-9]/gi, '_').toLowerCase() + '.json';
      if (!isTauriRuntime()) {
        localStorage.setItem(`theme_file_${filename}`, JSON.stringify(currentTheme, null, 2));
        setSavedThemes((prev) => Array.from(new Set([...prev, filename])));
        setActiveThemeName(filename);
        setSuccess(true);
        setTimeout(() => setSuccess(false), 2000);
        return;
      }

      const baseDir = await appDataDir();
      const themesDir = await join(baseDir, 'themes');
      if (!(await exists(themesDir))) {
        await mkdir(themesDir, { recursive: true });
      }
      const filePath = await join(themesDir, filename);
      await writeTextFile(filePath, JSON.stringify(currentTheme, null, 2));
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
      loadSavedThemes();
    } catch (err) {
      setError('Failed to save theme.');
    }
  };

  const handleLoadFromManager = async (filename: string) => {
    try {
      if (!isTauriRuntime()) {
        const content =
          localStorage.getItem(`theme_file_${filename}`) ||
          (filename === 'default.json' ? DEFAULT_THEME_JSON : null);
        if (!content) throw new Error('Theme is not available.');
        pushState(JSON.parse(content));
        setActiveThemeName(filename);
        return;
      }

      const baseDir = await appDataDir();
      const filePath = await join(baseDir, 'themes', filename);
      const content = await readTextFile(filePath);
      pushState(JSON.parse(content));
      setActiveThemeName(filename);
    } catch (err) {
      setError('Failed to load theme from disk.');
    }
  };

  const handleOpenThemesFolder = async () => {
    try {
      if (!isTauriRuntime()) {
        setError('Theme folders are only available in the desktop app.');
        return;
      }

      const baseDir = await appDataDir();
      const themesDir = await join(baseDir, 'themes');
      if (!(await exists(themesDir))) {
        await mkdir(themesDir, { recursive: true });
      }
      await invoke('open_themes_folder');
    } catch (err) {
      setError(`Failed to open folder: ${String(err)}`);
    }
  };

  const handleBrowseImage = async () => {
    const selected = await openDialog({
      multiple: false,
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'] }],
    });
    if (selected && typeof selected === 'string') {
      updateBackground('image', selected);
    }
  };

  const handleBrowseLogo = async () => {
    const selected = await openDialog({
      multiple: false,
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'] }],
    });
    if (selected && typeof selected === 'string') {
      updateLogo('image', selected);
    }
  };

  const handleBrowseVideo = async () => {
    const selected = await openDialog({
      multiple: false,
      filters: [{ name: 'Videos', extensions: ['mp4', 'webm'] }],
    });
    if (selected && typeof selected === 'string') {
      updateBackground('video', selected);
    }
  };

  const colorPickerProps = { currentTheme, onColorChange: updateColor };

  if (!currentTheme) return null;

  return (
    <div
      className="w-full h-screen text-text-primary flex flex-col font-sans overflow-hidden items-center relative"
      style={{
        backgroundColor:
          'color-mix(in srgb, var(--bg-base) calc(var(--app-opacity, 1) * 100%), transparent)',
      }}
    >
      <div className="w-full min-h-14 flex flex-wrap items-center justify-between gap-2 px-3 py-2 border-b border-border-subtle bg-transparent shrink-0 relative z-10 select-none">
        <div className="flex items-center gap-1">
          <button
            disabled={!canUndo}
            onClick={undo}
            className="h-8 w-8 inline-flex items-center justify-center text-text-secondary hover:text-text-primary disabled:opacity-30 transition-colors rounded-[var(--radius-md)] hover:bg-bg-elevated"
            aria-label="Undo"
          >
            <Undo2 size={16} />
          </button>
          <button
            disabled={!canRedo}
            onClick={redo}
            className="h-8 w-8 inline-flex items-center justify-center text-text-secondary hover:text-text-primary disabled:opacity-30 transition-colors rounded-[var(--radius-md)] hover:bg-bg-elevated"
            aria-label="Redo"
          >
            <Redo2 size={16} />
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-1.5 min-w-0">
          <Dropdown
            value={activeThemeName}
            onChange={(val) => {
              if (val) handleLoadFromManager(val);
            }}
            options={savedThemes.map((t) => ({ value: t, label: t.replace('.json', '') }))}
            placeholder="Load Theme..."
            width="w-[150px]"
          />
          <Button
            size="sm"
            variant="ghost"
            isIconOnly
            title="Open folder"
            aria-label="Open folder"
            onClick={handleOpenThemesFolder}
            className="border border-border-subtle bg-bg-surface/50"
          >
            <FolderOpen size={14} />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            isIconOnly
            title="Raw JSON"
            aria-label="Raw JSON"
            onClick={() => setShowJsonMode(!showJsonMode)}
            className="border border-border-subtle bg-bg-surface/50"
          >
            <Code size={14} />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            isIconOnly
            title="Save"
            aria-label="Save"
            onClick={handleSaveToManager}
            className="border border-border-subtle bg-bg-surface/50"
          >
            <Save size={14} />
          </Button>
          <Button
            size="sm"
            color="primary"
            className="h-8 px-2.5 font-bold shadow-sm min-w-0"
            onClick={handleApplyGlobal}
          >
            {success ? <Check size={14} className="mr-2" /> : <Upload size={14} className="mr-2" />}
            {success ? 'Applied!' : 'Apply'}
          </Button>
        </div>
      </div>

      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-danger/10 border-b border-danger/30 text-danger text-xs px-6 py-2 flex items-center justify-between shrink-0 z-0 w-full"
        >
          <span className="font-medium">{error}</span>
          <button onClick={() => setError(null)} className="opacity-80 hover:opacity-100">
            <X size={14} />
          </button>
        </motion.div>
      )}

      <div className="flex-1 overflow-y-auto custom-scrollbar w-full flex justify-center pb-12">
        {showJsonMode ? (
          <div className="w-full max-w-2xl flex flex-col px-6 py-8 h-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-bold tracking-wider text-text-secondary uppercase">
                Raw JSON Override
              </h3>
              <span className="text-xs text-text-muted">
                Changes here will sync to the visual editor immediately.
              </span>
            </div>
            <textarea
              value={JSON.stringify(currentTheme, null, 2)}
              onChange={(e) => {
                try {
                  const parsed = JSON.parse(e.target.value);
                  pushState(parsed);
                  setError(null);
                } catch (err) {}
              }}
              className="flex-1 w-full bg-bg-surface border border-border-subtle rounded-md p-4 font-mono text-sm resize-none outline-none focus:border-primary text-text-primary shadow-inner"
              spellCheck={false}
            />
          </div>
        ) : (
          <Window className="pb-12">
            <div className="flex flex-col gap-6 w-full">
              <div className="flex items-end justify-between gap-4">
                <div className="flex flex-col gap-2">
                  <h1 className="text-2xl font-bold text-text-primary tracking-tight">
                    Theme Editor
                  </h1>
                  <p className="text-sm text-text-muted font-medium">
                    Customize the visual appearance of ISpooferMotion.
                  </p>
                </div>
              </div>

              <Accordion
                selectionMode="multiple"
                expandedKeys={expandedKeys}
                onExpandedChange={setExpandedKeys}
                className="flex flex-col gap-6"
              >
                <AccordionItem
                  value="core"
                  title={<span className="font-semibold text-text-primary">Core Colors</span>}
                >
                  <Group>
                    <div className="flex flex-col gap-1.5 mb-4">
                      <label className="text-[13px] font-semibold text-text-primary pl-1">
                        Theme Name
                      </label>
                      <input
                        type="text"
                        value={currentTheme?.name || ''}
                        onChange={(e) => updateName(e.target.value)}
                        placeholder="e.g. Midnight Horizon"
                        className="w-full h-10 px-4 bg-bg-base border border-border-strong rounded-[var(--radius-md)] text-sm font-medium outline-none focus:border-primary transition-colors placeholder:text-text-muted shadow-sm"
                      />
                    </div>
                    <div className="flex flex-col divide-y divide-border-subtle/50">
                      <InlineColorPicker
                        {...colorPickerProps}
                        label="Accent / Primary"
                        colorKey="primary"
                      />
                      <InlineColorPicker
                        {...colorPickerProps}
                        label="App Background"
                        colorKey="background"
                      />
                      <InlineColorPicker
                        {...colorPickerProps}
                        label="Text Foreground"
                        colorKey="foreground"
                        checkContrastBg="background"
                      />
                      <InlineColorPicker
                        {...colorPickerProps}
                        label="Secondary Text"
                        colorKey="secondary"
                        checkContrastBg="background"
                      />
                      <InlineColorPicker
                        {...colorPickerProps}
                        label="Success Indicator"
                        colorKey="success"
                      />
                      <InlineColorPicker
                        {...colorPickerProps}
                        label="Warning Indicator"
                        colorKey="warning"
                      />
                      <InlineColorPicker
                        {...colorPickerProps}
                        label="Danger Indicator"
                        colorKey="danger"
                      />
                    </div>
                  </Group>
                </AccordionItem>

                <AccordionItem
                  value="surfaces"
                  title={<span className="font-semibold text-text-primary">UI Surfaces</span>}
                >
                  <Group>
                    <div className="flex flex-col divide-y divide-border-subtle/50">
                      <InlineColorPicker
                        {...colorPickerProps}
                        label="Surface (Sidebar, Popups)"
                        colorKey="content1"
                      />
                      <InlineColorPicker
                        {...colorPickerProps}
                        label="Elevated (Cards, Modals)"
                        colorKey="content2"
                      />
                      <InlineColorPicker
                        {...colorPickerProps}
                        label="Subdued Inputs"
                        colorKey="content3"
                      />
                      <InlineColorPicker
                        {...colorPickerProps}
                        label="Border Strong"
                        colorKey="border"
                      />
                      <InlineColorPicker
                        {...colorPickerProps}
                        label="Default Badges"
                        colorKey="default"
                      />
                    </div>
                  </Group>
                </AccordionItem>

                <AccordionItem
                  value="styling"
                  title={<span className="font-semibold text-text-primary">Styling & Effects</span>}
                >
                  <Group>
                    <div className="flex flex-col gap-4">
                      <div className="flex items-center justify-between">
                        <label className="text-[13px] font-semibold text-text-primary">
                          Border Radius
                        </label>
                        <Dropdown
                          value={currentTheme.style?.border_radius || '10px'}
                          onChange={(val) => updateStyle('border_radius', val)}
                          options={RADIUS_PRESETS}
                          width="w-[180px]"
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <label className="text-[13px] font-semibold text-text-primary">
                          Backdrop Blur
                        </label>
                        <Dropdown
                          value={currentTheme.style?.blur || '8px'}
                          onChange={(val) => updateStyle('blur', val)}
                          options={BLUR_PRESETS}
                          width="w-[180px]"
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <label className="text-[13px] font-semibold text-text-primary">
                          Elevation Shadows
                        </label>
                        <Dropdown
                          value={
                            SHADOW_PRESETS.find((p) => p.value === currentTheme.style?.shadow)
                              ?.value ||
                            currentTheme.style?.shadow ||
                            'none'
                          }
                          onChange={(val) => updateStyle('shadow', val)}
                          options={SHADOW_PRESETS}
                          width="w-[180px]"
                        />
                      </div>
                      <div className="flex flex-col gap-1.5 pt-2">
                        <label className="text-[13px] font-semibold text-text-primary flex items-center justify-between">
                          <span>App Transparency</span>
                          <span className="text-text-muted">
                            {percentLabel(currentTheme.style?.app_opacity)}
                          </span>
                        </label>
                        <input
                          type="range"
                          min="0.35"
                          max="1"
                          step="0.01"
                          value={currentTheme.style?.app_opacity ?? '1'}
                          onChange={(e) => updateStyle('app_opacity', e.target.value)}
                          style={rangeStyle(currentTheme.style?.app_opacity, 0.35, 1)}
                          className="theme-range"
                        />
                      </div>
                    </div>
                  </Group>
                </AccordionItem>

                <AccordionItem
                  value="media"
                  title={<span className="font-semibold text-text-primary">Background Media</span>}
                >
                  <Group>
                    <div className="flex flex-col gap-4">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[13px] font-semibold text-text-primary flex items-center gap-1.5">
                          <ImageIcon size={14} className="text-text-secondary" /> Image Background
                        </label>
                        <Row>
                          <input
                            type="text"
                            value={currentTheme.background?.image || ''}
                            onChange={(e) => updateBackground('image', e.target.value)}
                            placeholder="C:/Users/.../bg.png"
                            className="flex-1 h-10 px-3 bg-bg-base border border-border-strong rounded-[var(--radius-md)] text-[13px] outline-none focus:border-primary transition-colors"
                          />
                          <Button
                            size="sm"
                            variant="bordered"
                            onClick={handleBrowseImage}
                            className="h-10 px-3 shrink-0"
                          >
                            <FolderSearch size={14} />
                          </Button>
                        </Row>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[13px] font-semibold text-text-primary flex items-center gap-1.5">
                          <Video size={14} className="text-text-secondary" /> Video Background
                        </label>
                        <Row>
                          <input
                            type="text"
                            value={currentTheme.background?.video || ''}
                            onChange={(e) => updateBackground('video', e.target.value)}
                            placeholder="C:/Users/.../bg.mp4"
                            className="flex-1 h-10 px-3 bg-bg-base border border-border-strong rounded-[var(--radius-md)] text-[13px] outline-none focus:border-primary transition-colors"
                          />
                          <Button
                            size="sm"
                            variant="bordered"
                            onClick={handleBrowseVideo}
                            className="h-10 px-3 shrink-0"
                          >
                            <FolderSearch size={14} />
                          </Button>
                        </Row>
                      </div>
                    </div>
                  </Group>
                </AccordionItem>

                <AccordionItem
                  value="branding"
                  title={<span className="font-semibold text-text-primary">Branding</span>}
                >
                  <Group>
                    <div className="flex flex-col gap-4">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[13px] font-semibold text-text-primary flex items-center gap-1.5">
                          <ImageIcon size={14} className="text-text-secondary" /> Custom Logo Image
                        </label>
                        <Row>
                          <input
                            type="text"
                            value={currentTheme.logo?.image || ''}
                            onChange={(e) => updateLogo('image', e.target.value)}
                            placeholder="C:/Users/.../logo.png"
                            className="flex-1 h-10 px-3 bg-bg-base border border-border-strong rounded-[var(--radius-md)] text-[13px] outline-none focus:border-primary transition-colors"
                          />
                          <Button
                            size="sm"
                            variant="bordered"
                            onClick={handleBrowseLogo}
                            className="h-10 px-3 shrink-0"
                          >
                            <FolderSearch size={14} />
                          </Button>
                        </Row>
                        {currentTheme.logo?.image && (
                          <div className="mt-2 w-16 h-16 rounded-[var(--radius-md)] border border-border-subtle overflow-hidden bg-bg-elevated flex items-center justify-center p-2 shadow-sm">
                            <img
                              src={convertFileSrc(currentTheme.logo.image)}
                              alt="Preview"
                              className="max-w-full max-h-full object-contain"
                            />
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col gap-1.5 pt-2">
                        <label className="text-[13px] font-semibold text-text-primary flex items-center justify-between">
                          <span>Logo Transparency</span>
                          <span className="text-text-muted">
                            {percentLabel(currentTheme.logo?.opacity)}
                          </span>
                        </label>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.01"
                          value={currentTheme.logo?.opacity ?? '1'}
                          onChange={(e) => updateLogo('opacity', e.target.value)}
                          style={rangeStyle(currentTheme.logo?.opacity, 0, 1)}
                          className="theme-range"
                        />
                      </div>
                    </div>
                  </Group>
                </AccordionItem>
              </Accordion>
            </div>
          </Window>
        )}
      </div>
    </div>
  );
}

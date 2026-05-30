import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, FolderSearch, Play, Users, UserSquare2, Wand2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import AnimationIcon from '../../assets/roblox_icons/Animation.png';
import DecalIcon from '../../assets/roblox_icons/Decal.png';
import MeshIcon from '../../assets/roblox_icons/MeshPart.png';
import ScriptIcon from '../../assets/roblox_icons/Script.png';
import SoundIcon from '../../assets/roblox_icons/Sound.png';
import VideoIcon from '../../assets/roblox_icons/VideoFrame.png';
import { useConfig } from '../../contexts/ConfigContext';
import { useLanguage } from '../../contexts/LanguageContext';
import {
  Accordion,
  AccordionItem,
  Button,
  FormInput,
  FormTextarea,
  FormToggle,
  Group,
  itemVariants,
  MultiSelectDropdown,
  pageVariants,
  Row,
  Spinner,
  Window,
} from '../../ism-library';
import {
  loadCachedGroups,
  loadCachedUsers,
  logIsm,
  normalizeId,
  RobloxGroup,
  RobloxUserInfo,
  saveCachedGroups,
} from '../../utils/robloxProfiles';

function AvatarDropdown({
  users,
  value,
  onChange,
  loading,
}: {
  users: RobloxUserInfo[];
  value: string;
  onChange: (v: string) => void;
  loading: boolean;
}) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 200 });

  const selected = users.find((u) => normalizeId(u.id) === normalizeId(value));
  const label = selected ? selected.displayName || selected.name : 'None';

  const toggleMenu = () => {
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setCoords({ top: rect.bottom + 4, left: rect.left, width: rect.width });
    }
    setOpen((prev) => !prev);
  };

  return (
    <div className="flex items-center justify-between w-full">
      <span className="text-sm font-medium text-text-primary mr-4 shrink-0">Selected User</span>
      <button
        ref={btnRef}
        type="button"
        onClick={toggleMenu}
        className="flex items-center gap-2 h-10 px-3 bg-bg-surface border border-border-strong rounded-[var(--radius-md)] text-[13px] font-medium text-text-primary hover:border-primary transition-colors min-w-[180px] max-w-[240px] w-full"
      >
        <div className="relative w-6 h-6 shrink-0 flex items-center justify-center">
          <AnimatePresence mode="wait">
            {loading ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0, scale: 0.8, rotate: -45 }}
                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                exit={{ opacity: 0, scale: 0.8, rotate: 45 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                className="absolute inset-0 flex items-center justify-center"
              >
                <Spinner size="sm" color="current" className="text-text-muted" />
              </motion.div>
            ) : selected?.avatarUrl ? (
              <motion.img
                key={selected.avatarUrl}
                src={selected.avatarUrl}
                alt={label}
                initial={{ opacity: 0, scale: 0.8, rotate: -15 }}
                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                exit={{ opacity: 0, scale: 0.8, rotate: 15 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                className="absolute inset-0 w-6 h-6 rounded-full object-cover"
              />
            ) : (
              <motion.div
                key="empty"
                initial={{ opacity: 0, scale: 0.8, rotate: -15 }}
                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                exit={{ opacity: 0, scale: 0.8, rotate: 15 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                className="absolute inset-0 rounded-full bg-bg-elevated flex items-center justify-center"
              >
                <UserSquare2 size={12} className="text-text-muted" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <AnimatePresence mode="wait">
          <motion.div
            key={selected?.id || 'none'}
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -8 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="min-w-0 flex-1 text-left truncate"
          >
            {label}
          </motion.div>
        </AnimatePresence>
        <motion.span
          initial={false}
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
          className="text-text-muted shrink-0"
        >
          <ChevronDown size={14} />
        </motion.span>
      </button>

      {createPortal(
        <AnimatePresence>
          {open && (
            <>
              <div className="fixed inset-0 z-[490]" onPointerDown={() => setOpen(false)} />
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.97 }}
                transition={{ duration: 0.15, ease: 'easeOut' }}
                onPointerDown={(e) => e.stopPropagation()}
                className="fixed z-[500] bg-bg-surface border border-border-subtle rounded-[var(--radius-md)] shadow-floating overflow-hidden"
                style={{ top: coords.top, left: coords.left, width: coords.width, minWidth: 180 }}
              >
                <div className="max-h-64 overflow-y-auto">
                  <button
                    type="button"
                    onClick={() => {
                      onChange('none');
                      setOpen(false);
                    }}
                    className={`flex items-center gap-3 w-full px-3 py-2 text-left text-[13px] hover:bg-bg-elevated transition-colors ${value === 'none' ? 'text-primary font-semibold' : 'text-text-primary'}`}
                  >
                    <div className="w-7 h-7 rounded-full bg-bg-elevated flex items-center justify-center shrink-0">
                      <UserSquare2 size={14} className="text-text-muted" />
                    </div>
                    None
                  </button>
                  {users.map((user, index) => (
                    <motion.button
                      key={user.id}
                      type="button"
                      initial={{ opacity: 0, x: -4 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.14, delay: Math.min(index * 0.025, 0.12) }}
                      onClick={() => {
                        onChange(String(user.id));
                        setOpen(false);
                      }}
                      className={`flex items-center gap-3 w-full px-3 py-2 text-left text-[13px] hover:bg-bg-elevated transition-colors ${normalizeId(user.id) === normalizeId(value) ? 'text-primary font-semibold' : 'text-text-primary'}`}
                    >
                      {user.avatarUrl ? (
                        <img
                          src={user.avatarUrl}
                          alt={user.displayName}
                          className="w-7 h-7 rounded-full shrink-0 object-cover ring-1 ring-border-subtle"
                        />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-bg-elevated flex items-center justify-center shrink-0">
                          <UserSquare2 size={14} className="text-text-muted" />
                        </div>
                      )}
                      <div className="flex flex-col min-w-0">
                        <span className="truncate font-medium">
                          {user.displayName || user.name}
                        </span>
                        {user.displayName !== user.name && (
                          <span className="text-[11px] text-text-muted truncate">@{user.name}</span>
                        )}
                      </div>
                    </motion.button>
                  ))}
                  {users.length === 0 && !loading && (
                    <div className="px-3 py-4 text-center text-[12px] text-text-muted">
                      No saved users. Add one in Config.
                    </div>
                  )}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </div>
  );
}

function GroupDropdown({
  groups,
  value,
  onChange,
  loading,
}: {
  groups: RobloxGroup[];
  value: string;
  onChange: (v: string) => void;
  loading: boolean;
}) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 200 });
  const selected = groups.find((g) => normalizeId(g.id) === normalizeId(value));
  const label = selected ? selected.name : 'None';

  const toggleMenu = () => {
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setCoords({ top: rect.bottom + 4, left: rect.left, width: rect.width });
    }
    setOpen((prev) => !prev);
  };

  return (
    <div className="flex items-center justify-between w-full">
      <span className="text-sm font-medium text-text-primary mr-4 shrink-0">Selected Group</span>
      <button
        ref={btnRef}
        type="button"
        onClick={toggleMenu}
        className="flex items-center gap-2 h-10 px-3 bg-bg-surface border border-border-strong rounded-[var(--radius-md)] text-[13px] font-medium text-text-primary hover:border-primary transition-colors min-w-[180px] max-w-[240px] w-full"
      >
        <div className="relative w-6 h-6 shrink-0 flex items-center justify-center">
          <AnimatePresence mode="wait">
            {loading ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0, scale: 0.8, rotate: -45 }}
                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                exit={{ opacity: 0, scale: 0.8, rotate: 45 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                className="absolute inset-0 flex items-center justify-center"
              >
                <Spinner size="sm" color="current" className="text-text-muted" />
              </motion.div>
            ) : selected?.iconUrl ? (
              <motion.img
                key={selected.iconUrl}
                src={selected.iconUrl}
                alt={label}
                initial={{ opacity: 0, scale: 0.8, rotate: -15 }}
                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                exit={{ opacity: 0, scale: 0.8, rotate: 15 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                className="absolute inset-0 w-6 h-6 rounded-full object-cover"
              />
            ) : (
              <motion.div
                key="empty"
                initial={{ opacity: 0, scale: 0.8, rotate: -15 }}
                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                exit={{ opacity: 0, scale: 0.8, rotate: 15 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                className="absolute inset-0 rounded-full bg-bg-elevated flex items-center justify-center"
              >
                <Users size={12} className="text-text-muted" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <AnimatePresence mode="wait">
          <motion.div
            key={selected?.id || 'none'}
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -8 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="min-w-0 flex-1 text-left truncate"
          >
            {label}
          </motion.div>
        </AnimatePresence>
        <motion.span
          initial={false}
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
          className="text-text-muted shrink-0"
        >
          <ChevronDown size={14} />
        </motion.span>
      </button>

      {createPortal(
        <AnimatePresence>
          {open && (
            <>
              <div className="fixed inset-0 z-[490]" onPointerDown={() => setOpen(false)} />
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.97 }}
                transition={{ duration: 0.15, ease: 'easeOut' }}
                onPointerDown={(e) => e.stopPropagation()}
                className="fixed z-[500] bg-bg-surface border border-border-subtle rounded-[var(--radius-md)] shadow-floating overflow-hidden"
                style={{ top: coords.top, left: coords.left, width: coords.width, minWidth: 180 }}
              >
                <div className="max-h-64 overflow-y-auto">
                  <button
                    type="button"
                    onClick={() => {
                      onChange('none');
                      setOpen(false);
                    }}
                    className={`flex items-center gap-3 w-full px-3 py-2 text-left text-[13px] hover:bg-bg-elevated transition-colors ${value === 'none' ? 'text-primary font-semibold' : 'text-text-primary'}`}
                  >
                    <div className="w-7 h-7 rounded-full bg-bg-elevated flex items-center justify-center shrink-0">
                      <Users size={14} className="text-text-muted" />
                    </div>
                    None
                  </button>
                  {groups.map((group, index) => (
                    <motion.button
                      key={group.id}
                      type="button"
                      initial={{ opacity: 0, x: -4 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.14, delay: Math.min(index * 0.025, 0.12) }}
                      onClick={() => {
                        onChange(String(group.id));
                        setOpen(false);
                      }}
                      className={`flex items-center gap-3 w-full px-3 py-2 text-left text-[13px] hover:bg-bg-elevated transition-colors ${normalizeId(group.id) === normalizeId(value) ? 'text-primary font-semibold' : 'text-text-primary'}`}
                    >
                      {group.iconUrl ? (
                        <img
                          src={group.iconUrl}
                          alt={group.name}
                          className="w-7 h-7 rounded-full shrink-0 object-cover ring-1 ring-border-subtle"
                        />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-bg-elevated flex items-center justify-center shrink-0">
                          <Users size={14} className="text-text-muted" />
                        </div>
                      )}
                      <span className="truncate font-medium">{group.name}</span>
                    </motion.button>
                  ))}
                  {groups.length === 0 && !loading && (
                    <div className="px-3 py-4 text-center text-[12px] text-text-muted">
                      No groups found. Add credentials in Config, then select a user.
                    </div>
                  )}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </div>
  );
}

export default function SpoofingView() {
  const { t } = useLanguage();
  const { config, updateConfig, updateCategory, rootInstances, selectedAssetIds, applyReplacements } = useConfig();
  const [users, setUsers] = useState<RobloxUserInfo[]>(loadCachedUsers);
  const [groups, setGroups] = useState<RobloxGroup[]>(() =>
    loadCachedGroups(config.spoofing.selectedUser),
  );
  const loadingUsers = false;
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [isSpoofing, setIsSpoofing] = useState(false);
  const [spoofProgress, setSpoofProgress] = useState(0);
  const [logs, setLogs] = useState<string>('');
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll output to bottom whenever new log lines arrive
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  useEffect(() => {
    const refreshUsers = () => setUsers(loadCachedUsers());
    window.addEventListener('storage', refreshUsers);
    window.addEventListener('focus', refreshUsers);
    return () => {
      window.removeEventListener('storage', refreshUsers);
      window.removeEventListener('focus', refreshUsers);
    };
  }, []);

  useEffect(() => {
    const userId = config.spoofing.selectedUser;
    const cachedGroups = loadCachedGroups(userId);
    setGroups(cachedGroups);

    if (!config.spoofing.cookie || !userId || userId === 'none') {
      setLoadingGroups(false);
      return;
    }

    let cancelled = false;
    const run = async () => {
      try {
        setLoadingGroups(true);
        const rawGroups = await invoke<RobloxGroup[]>('get_manageable_groups', {
          cookie: config.spoofing.cookie,
        });
        const withIcons = await Promise.all(
          rawGroups.map(async (group) => {
            const iconUrl = await invoke<string>('get_group_icon', {
              groupId: String(group.id),
            }).catch(() => '');
            return { ...group, iconUrl: iconUrl || undefined };
          }),
        );
        if (!cancelled) {
          setGroups(withIcons);
          saveCachedGroups(userId, withIcons);
          const selectedGroupExists = withIcons.some(
            (group) => normalizeId(group.id) === normalizeId(config.spoofing.selectedGroup),
          );
          if (config.spoofing.selectedGroup !== 'none' && !selectedGroupExists) {
            updateConfig('spoofing', 'selectedGroup', 'none');
          }
        }
      } catch {
        if (!cancelled) setGroups(cachedGroups);
      } finally {
        if (!cancelled) setLoadingGroups(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [
    config.spoofing.cookie,
    config.spoofing.selectedUser,
    config.spoofing.selectedGroup,
    updateConfig,
  ]);

  const handleSelectedUserChange = async (userId: string) => {
    updateCategory('spoofing', {
      selectedUser: userId,
      selectedGroup: 'none',
      cookie: '',
    });
    setGroups(loadCachedGroups(userId));

    if (!userId || userId === 'none') return;
  };

  const handleBrowseFolder = async () => {
    const selected = await openDialog({ multiple: false, directory: true });
    if (selected && typeof selected === 'string') {
      updateConfig('spoofing', 'downloadPath', selected);
    }
  };

  const spoofOptions = [
    { value: 'animation', label: 'Animations', icon: AnimationIcon },
    { value: 'audio', label: 'Audio', icon: SoundIcon },
    { value: 'images', label: 'Images', icon: DecalIcon },
    { value: 'meshes', label: 'Meshes', icon: MeshIcon },
    { value: 'scriptRefs', label: 'Script Refs', icon: ScriptIcon },
    {
      value: 'videos',
      displayLabel: 'Videos',
      label: (
        <span className="flex items-center gap-2">
          Videos
          <span className="text-[10px] font-bold text-red-500 bg-red-500/10 px-1.5 py-0.5 rounded uppercase tracking-wider">
            Experimental
          </span>
        </span>
      ),
      icon: VideoIcon,
    },
  ];

  const selectedSpoofTypes = spoofOptions
    .filter((option) => config.spoofing[option.value as keyof typeof config.spoofing])
    .map((option) => option.value);

  const handleSpoofTypesChange = (values: string[]) => {
    const changes: Record<string, boolean> = {};
    spoofOptions.forEach((option) => {
      changes[option.value] = values.includes(option.value);
    });
    updateCategory('spoofing', changes);
  };

  const handleRunSpoofer = async () => {
    setIsSpoofing(true);
    setSpoofProgress(0);
    setLogs('');

    let unlistenProgress: (() => void) | undefined;
    let unlistenLog: (() => void) | undefined;
    let unlistenResult: (() => void) | undefined;

    try {
      unlistenProgress = await listen('spoofer-progress', (event: any) => {
        const { current, total } = event.payload;
        setSpoofProgress(total > 0 ? (current / total) * 100 : 0);
      });

      unlistenLog = await listen('spoofer-log', (event: any) => {
        setLogs(
          (prev) => prev + `[${event.payload.level.toUpperCase()}] ${event.payload.message}\n`,
        );
      });

      unlistenResult = await listen('spoofer-result', (event: any) => {
        setIsSpoofing(false);
        if (event.payload.success) {
          logIsm('success', 'Spoofing completed successfully.', true);
          if (event.payload.replacements) {
            applyReplacements(event.payload.replacements);
            
            // Auto-replace in Studio
            const port = config.advanced.pluginPort || '3100';
            const mappings = Object.entries(event.payload.replacements).map(([oldId, newId]) => ({
              originalId: oldId,
              newId
            }));

            try {
              await fetch(`http://localhost:${port}/replace-ids`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mappings }),
                signal: AbortSignal.timeout(2000)
              });
              logIsm('success', 'Sent auto-replace instructions to Studio plugin.', true);
            } catch (err) {
              logIsm('warn', 'Failed to send replacements to Studio (is it connected?).', true);
            }
          }
          setSpoofProgress(100);
        } else {
          logIsm('error', 'Spoofing failed: ' + event.payload.output, true);
        }

        unlistenProgress?.();
        unlistenLog?.();
        unlistenResult?.();
      });

      const getAssetId = (asset: any) => {
        if ('assetId' in asset) return asset.assetId;
        return asset.id ?? '';
      };

      const finalAssetIds = new Set<string>();

      // Add checked items from Explorer
      selectedAssetIds.forEach((id) => finalAssetIds.add(id));

      // Add all items matching selected types from the Spoofer dropdown
      const selectedTypes = new Set(selectedSpoofTypes);
      const gatherByType = (nodes: any[]) => {
        for (const node of nodes) {
          for (const asset of node.assets) {
            if (selectedTypes.has(asset.type)) {
              const id = getAssetId(asset);
              if (id) finalAssetIds.add(id);
            }
          }
          if (node.children) gatherByType(node.children);
        }
      };
      if (rootInstances.length > 0) {
        gatherByType(rootInstances);
      }

      //Add manual text input
      if (config.advanced.forcePlaceIds) {
        config.advanced.forcePlaceIds.split(',').forEach((id) => {
          const trimmed = id.trim();
          if (trimmed) finalAssetIds.add(trimmed);
        });
      }

      await invoke('run_spoofer_action', {
        data: {
          assets: Array.from(finalAssetIds).join(','),
          cookie: config.spoofing.cookie,
          apiKey: config.spoofing.apiKey,
          groupId: config.spoofing.selectedGroup !== 'none' ? config.spoofing.selectedGroup : null,
          spoofSounds: config.spoofing.audio,
          downloadOnly: config.spoofing.downloadMode,
          concurrent: false,
        },
      });
    } catch (err) {
      logIsm('error', 'Failed to start spoofer: ' + err, true);
      setIsSpoofing(false);

      unlistenProgress?.();
      unlistenLog?.();
      unlistenResult?.();
    }
  };

  const handleStopSpoofer = async () => {
    try {
      await invoke('spoofer_cancel');
      setLogs((prev) => prev + '[INFO] Cancelling spoofer...\n');
    } catch (err) {
      logIsm('error', 'Failed to cancel spoofer: ' + err, true);
    }
  };

  return (
    <motion.div
      variants={pageVariants}
      initial="hidden"
      animate="show"
      exit="exit"
      className="w-full h-full tour-spoofer-page"
    >
      <Window>
        <motion.div variants={itemVariants} className="w-full flex flex-col gap-8">
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-bold text-text-primary tracking-tight">
              {t('spoof.title')}
            </h1>
            <p className="text-sm text-text-muted font-medium">{t('spoof.subtitle')}</p>
          </div>

          <Accordion
            selectionMode="multiple"
            expandedKeys={config.ui.spoofingSections}
            onExpandedChange={(keys) => updateConfig('ui', 'spoofingSections', keys)}
            className="flex flex-col gap-6"
          >
            <AccordionItem
              value="targets"
              title={
                <span className="flex items-center gap-3 font-semibold">
                  <UserSquare2 size={18} className="text-primary" /> Targets
                </span>
              }
              className="tour-spoofer-targets"
            >
              <Group>
                <AvatarDropdown
                  users={users}
                  value={config.spoofing.selectedUser}
                  onChange={handleSelectedUserChange}
                  loading={loadingUsers}
                />
                <GroupDropdown
                  groups={groups}
                  value={config.spoofing.selectedGroup}
                  onChange={(value) => updateConfig('spoofing', 'selectedGroup', value)}
                  loading={loadingGroups}
                />
                <div className="flex flex-col gap-1.5">
                  <span className="text-[13px] font-semibold text-text-primary px-1">
                    Select Assets to Spoof
                  </span>
                  <MultiSelectDropdown
                    options={spoofOptions}
                    values={selectedSpoofTypes}
                    onChange={handleSpoofTypesChange}
                    placeholder="Select asset types..."
                  />
                </div>
              </Group>
            </AccordionItem>

            <AccordionItem
              value="execution"
              title={
                <span className="flex items-center gap-3 font-semibold">
                  <Wand2 size={18} className="text-primary" /> Execution
                </span>
              }
              className="tour-spoofer-execution"
            >
              <Group>
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-text-secondary">Output</span>
                  <div
                    className="h-36 overflow-y-auto bg-bg-base border border-border-subtle rounded-[var(--radius-md)] p-2 font-mono text-[11px] text-text-secondary leading-relaxed"
                  >
                    {logs
                      ? logs.split('\n').filter(Boolean).map((line, i) => {
                          const level = line.startsWith('[ERROR]') ? 'error'
                            : line.startsWith('[WARN]') ? 'warn'
                            : line.startsWith('[SUCCESS]') ? 'success'
                            : 'info';
                          return (
                            <div
                              key={i}
                              className={`mb-0.5 ${
                                level === 'error' ? 'text-red-400'
                                : level === 'warn' ? 'text-yellow-400'
                                : level === 'success' ? 'text-green-400'
                                : 'text-text-secondary'
                              }`}
                            >
                              {line}
                            </div>
                          );
                        })
                      : <span className="text-text-muted/40">Output will appear here...</span>
                    }
                    <div ref={logsEndRef} />
                  </div>
                </div>
                <FormToggle
                  label={t('settings.skipOwned')}
                  description={t('settings.skipOwnedDescription')}
                  checked={config.advanced.skipOwned}
                  onChange={(value) => updateConfig('advanced', 'skipOwned', value)}
                />
                <div className="flex flex-col">
                  <FormToggle
                    label={
                      <span className="font-bold text-sm text-text-primary">Download Mode</span>
                    }
                    checked={config.spoofing.downloadMode}
                    onChange={(value) => updateConfig('spoofing', 'downloadMode', value)}
                  />
                  <AnimatePresence initial={false}>
                    {config.spoofing.downloadMode && (
                      <motion.div
                        key="download-mode-input"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25, ease: [0.04, 0.62, 0.23, 0.98] }}
                        className="overflow-hidden"
                      >
                        <div className="pt-4 pb-1">
                          <FormInput
                            label={t('spoof.downloadPath')}
                            placeholder={t('spoof.downloadPathPlaceholder')}
                            value={config.spoofing.downloadPath || ''}
                            onChange={(value: string) =>
                              updateConfig('spoofing', 'downloadPath', value)
                            }
                            endContent={
                              <button
                                type="button"
                                onClick={handleBrowseFolder}
                                className="p-1 rounded hover:bg-bg-elevated text-text-muted hover:text-primary transition-colors"
                                aria-label="Browse folder"
                              >
                                <FolderSearch size={16} />
                              </button>
                            }
                          />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                <Row>
                  <Button
                    color="primary"
                    className="flex-1 font-bold h-12 tracking-wide overflow-hidden relative"
                    onClick={handleRunSpoofer}
                    disabled={isSpoofing}
                  >
                    <div className="relative z-10 flex items-center justify-center gap-2 w-full h-full">
                      {!isSpoofing && <Play size={18} fill="currentColor" />}
                      <span>
                        {isSpoofing
                          ? `Spoofing... ${Math.round(spoofProgress)}%`
                          : t('spoof.runSpoofer')}
                      </span>
                    </div>
                    {isSpoofing && (
                      <div
                        className="absolute left-0 top-0 bottom-0 bg-black/25 pointer-events-none"
                        style={{ width: `${spoofProgress}%`, transition: 'width 50ms linear' }}
                      />
                    )}
                  </Button>
                  <Button
                    variant="bordered"
                    className="font-bold h-12 px-8 tracking-wide text-red-500 border-red-500/50 hover:bg-red-500/10"
                    disabled={!isSpoofing}
                    label="Stop"
                    onClick={handleStopSpoofer}
                  />
                </Row>
              </Group>
            </AccordionItem>
          </Accordion>
        </motion.div>
      </Window>
    </motion.div>
  );
}

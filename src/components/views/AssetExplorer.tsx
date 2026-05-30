import { convertFileSrc } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { open as openFilePicker } from '@tauri-apps/plugin-dialog';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  FileUp,
  FolderOpen,
  Play,
  Filter,
  Volume2,
  Square,
  CheckSquare,
  MinusSquare,
  ZoomIn,
  Clapperboard,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import AnimationPreview from '../AnimationPreview';
import { useConfig } from '../../contexts/ConfigContext';
import { Button, Spinner, MultiSelectDropdown } from '../../ism-library';
import { playRobloxAudio } from '../../utils/robloxAudio';
import type { ParseProgress, ParsedAssetRef, RbxInstance } from '../../utils/robloxPlaceParser';
import { parsePlaceUrlInWorker } from '../../utils/robloxPlaceParser';
import { logIsm } from '../../utils/robloxProfiles';

interface AssetExplorerProps {
  isOpen: boolean;
  setIsOpen: (val: boolean) => void;
}

const getAssetId = (asset: ParsedAssetRef | { id: string; name: string }) => {
  if ('assetId' in asset) return asset.assetId;
  return asset.id ?? '';
};

function RbxNode({
  node,
  level,
  config,
  selectedAssetIds,
  toggleAsset,
  toggleNode,
  getAllAssetIds,
  setEnlargedImage,
  setPlayingVideo,
  setPreviewingAnimation,
  activeAssetFilters,
}: {
  node: RbxInstance;
  level: number;
  config: any;
  selectedAssetIds: Set<string>;
  toggleAsset: (id: string, checked: boolean) => void;
  toggleNode: (node: RbxInstance, checked: boolean) => void;
  getAllAssetIds: (node: RbxInstance) => string[];
  setEnlargedImage: (val: { id: string; name: string } | null) => void;
  setPlayingVideo: (id: string | null) => void;
  setPreviewingAnimation: (val: { id: string; name: string } | null) => void;
  activeAssetFilters: string[];
}) {
  // Expand top-level nodes by default
  const [expanded, setExpanded] = useState(false);
  const [visibleCount, setVisibleCount] = useState(100);

  const filteredAssets = node.assets.filter((a) => activeAssetFilters.includes(a.type));
  const totalItems = filteredAssets.length + node.children.length;


  const allIds = getAllAssetIds(node);
  if (allIds.length === 0) return null;

  const selectedCount = allIds.filter((id) => selectedAssetIds.has(id)).length;
  const isChecked = allIds.length > 0 && selectedCount === allIds.length;
  const isIndeterminate = selectedCount > 0 && selectedCount < allIds.length;

  const copyAssetId = async (asset: ParsedAssetRef) => {
    const assetId = getAssetId(asset);
    if (!assetId) return;
    await navigator.clipboard.writeText(assetId);
    logIsm('success', `Copied asset id ${assetId}.`);
  };

  const playAsset = async (asset: ParsedAssetRef) => {
    const assetId = getAssetId(asset);
    if (!assetId) {
      logIsm('warn', 'Cannot play Roblox audio without an asset id.');
      return;
    }
    await playRobloxAudio(assetId, config).catch((err) => {
      logIsm('error', `Failed to play Roblox audio ${assetId}: ${String(err)}`);
    });
  };

  return (
    <div className="flex flex-col">
      <div
        className="flex items-center py-1 px-1 hover:bg-bg-elevated/40 cursor-pointer rounded-sm group select-none"
        style={{ paddingLeft: `${level * 16}px` }}
        onClick={() => setExpanded(!expanded)}
      >
        <div
          className="mr-2 cursor-pointer text-text-muted hover:text-primary transition-colors flex items-center justify-center shrink-0 relative w-[13px] h-[13px]"
          onClick={(e) => {
            e.stopPropagation();
            if (allIds.length > 0) toggleNode(node, !isChecked);
          }}
        >
          {allIds.length > 0 && (
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.div
                key={isChecked ? 'checked' : isIndeterminate ? 'partial' : 'unchecked'}
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.5, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                className="absolute inset-0"
              >
                {isChecked ? (
                  <CheckSquare size={13} className="text-primary" />
                ) : isIndeterminate ? (
                  <MinusSquare size={13} className="text-primary opacity-80" />
                ) : (
                  <Square size={13} />
                )}
              </motion.div>
            </AnimatePresence>
          )}
        </div>
        <div className="w-4 h-4 flex items-center justify-center shrink-0 mr-1">
          {node.children.length > 0 ? (
            <ChevronRight
              size={12}
              className={`transition-transform text-text-muted ${expanded ? 'rotate-90' : ''}`}
            />
          ) : null}
        </div>

        <div className="w-4 h-4 shrink-0 mr-2 flex items-center justify-center">
          <img
            src={`/icons/${node.className}.png`}
            alt=""
            className="w-full h-full object-contain"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              // Prevent infinite loop if fallback fails
              if (!target.src.endsWith('Object.png')) {
                target.src = '/icons/Object.png';
              } else {
                target.style.display = 'none';
              }
            }}
          />
        </div>

        <span className="text-xs text-text-primary whitespace-nowrap overflow-hidden text-ellipsis">
          {node.name}
        </span>
      </div>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="flex flex-col overflow-hidden"
          >
            {filteredAssets
              .slice(0, visibleCount)
              .map((asset, i) => {
                const assetId = getAssetId(asset);
                const isSound = asset.type === 'audio';
                return (
                  <div
                    key={`${assetId}-${i}`}
                    className="flex items-center py-1 pl-1 pr-2 hover:bg-bg-elevated/60 group rounded-sm"
                    style={{ paddingLeft: `${(level + 1) * 16 + 20}px` }}
                  >
                    <div
                      className="mr-2 cursor-pointer text-text-muted hover:text-primary transition-colors flex items-center justify-center shrink-0 relative w-[13px] h-[13px]"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleAsset(assetId, !selectedAssetIds.has(assetId));
                      }}
                    >
                      <AnimatePresence mode="popLayout" initial={false}>
                        <motion.div
                          key={selectedAssetIds.has(assetId) ? 'checked' : 'unchecked'}
                          initial={{ scale: 0.5, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0.5, opacity: 0 }}
                          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                          className="absolute inset-0"
                        >
                          {selectedAssetIds.has(assetId) ? (
                            <CheckSquare size={13} className="text-primary" />
                          ) : (
                            <Square size={13} />
                          )}
                        </motion.div>
                      </AnimatePresence>
                    </div>
                    <div className="w-3 h-3 shrink-0 mr-2 flex items-center justify-center text-text-muted">
                      {isSound ? <Volume2 size={12} /> : <FolderOpen size={12} />}
                    </div>
                    <div className="flex-1 flex flex-col min-w-0">
                      <span className="text-[11px] text-text-secondary truncate">
                        {asset.propertyName}
                      </span>
                      <span className="text-[9px] text-text-muted truncate">{assetId}</span>
                    </div>
                    <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
                      {isSound && (
                        <Button
                          isIconOnly
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 min-w-6"
                          onClick={(e) => {
                            e.stopPropagation();
                            playAsset(asset);
                          }}
                        >
                          <Play size={11} fill="currentColor" />
                        </Button>
                      )}
                      {(asset.type === 'image' || asset.type === 'mesh') && (
                        <Button
                          isIconOnly
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 min-w-6"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEnlargedImage({ id: assetId, name: asset.instanceName });
                          }}
                        >
                          <ZoomIn size={11} />
                        </Button>
                      )}
                      {asset.type === 'animation' && (
                        <Button
                          isIconOnly
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 min-w-6 text-primary"
                          title="Preview Animation"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPreviewingAnimation({ id: assetId, name: asset.instanceName });
                          }}
                        >
                          <Clapperboard size={11} />
                        </Button>
                      )}
                      {asset.type === 'video' && (
                        <Button
                          isIconOnly
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 min-w-6"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPlayingVideo(assetId);
                          }}
                        >
                          <Play size={11} fill="currentColor" />
                        </Button>
                      )}
                      <Button
                        isIconOnly
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 min-w-6"
                        onClick={(e) => {
                          e.stopPropagation();
                          copyAssetId(asset);
                        }}
                      >
                        <Copy size={11} />
                      </Button>
                    </div>
                  </div>
                );
              })}
            {node.children.slice(0, Math.max(0, visibleCount - filteredAssets.length)).map((child, i) => (
              <RbxNode
                key={`${child.referent}-${i}`}
                node={child}
                level={level + 1}
                config={config}
                selectedAssetIds={selectedAssetIds}
                toggleAsset={toggleAsset}
                toggleNode={toggleNode}
                getAllAssetIds={getAllAssetIds}
                setEnlargedImage={setEnlargedImage}
                setPlayingVideo={setPlayingVideo}
                setPreviewingAnimation={setPreviewingAnimation}
                activeAssetFilters={activeAssetFilters}
              />
            ))}
            {visibleCount < totalItems && (
              <div 
                className="py-2 flex justify-center items-center"
                style={{ paddingLeft: `${(level + 1) * 16}px` }}
              >
                <Button
                  variant="outline"
                  size="sm"
                  className="text-[10px] h-6 px-3 w-auto border-border-strong text-text-secondary hover:text-text-primary"
                  onClick={(e) => {
                    e.stopPropagation();
                    setVisibleCount((prev) => prev + 100);
                  }}
                >
                  Load 100 more... ({totalItems - visibleCount} remaining)
                </Button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const ASSET_TYPE_OPTIONS = [
  { value: 'audio', label: 'Audio' },
  { value: 'image', label: 'Images' },
  { value: 'animation', label: 'Animations' },
  { value: 'mesh', label: 'Meshes' },
  { value: 'video', label: 'Videos' },
  { value: 'script_ref', label: 'Scripts' },
];

/** Convert flat plugin asset list into an RbxInstance subtree. */
function pluginAssetsToNode(
  folderName: string,
  className: string,
  assets: any[],
  assetType: ParsedAssetRef['type'],
): RbxInstance {
  return {
    referent: `studio-${folderName}`,
    className,
    name: folderName,
    assets: assets.map(
      (a: any): ParsedAssetRef => ({
        type: assetType,
        assetId: a.assetId,
        rawValue: `rbxassetid://${a.assetId}`,
        className: a.kind ?? className,
        instanceName: a.name ?? a.assetId,
        propertyName: a.fullName ?? '',
        path: a.fullName ?? folderName,
      }),
    ),
    children: [],
  };
}


export default function AssetExplorer({ isOpen, setIsOpen }: AssetExplorerProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [studioConnected, setStudioConnected] = useState(false);
  const [parseState, setParseState] = useState<ParseProgress | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [enlargedImage, setEnlargedImage] = useState<{ id: string; name: string } | null>(null);
  const [playingVideo, setPlayingVideo] = useState<string | null>(null);
  const [previewingAnimation, setPreviewingAnimation] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [activeAssetFilters, setActiveAssetFilters] = useState<string[]>(
    ASSET_TYPE_OPTIONS.map((o) => o.value),
  );
  const [studioScanPending, setStudioScanPending] = useState(false);
  const {
    config,
    updateConfig,
    rootInstances,
    setRootInstances,
    loadedFileName,
    setLoadedFileName,
    parsingFileName,
    setParsingFileName,
    selectedAssetIds,
    setSelectedAssetIds,
  } = useConfig();

  useEffect(() => {
    updateConfig('advanced', 'forcePlaceIds', Array.from(selectedAssetIds).join(','));
  }, [selectedAssetIds, updateConfig]);

  // Check if the Studio plugin server is reachable and trigger auto-scan if connected
  useEffect(() => {
    const port = config.advanced.pluginPort || '3100';
    let isCurrentlyConnected = false;

    const check = () => {
      fetch(`http://localhost:${port}/health`, { signal: AbortSignal.timeout(800) })
        .then((res) => res.json())
        .then((data) => {
          const connected = data.plugin_connected === true;
          
          if (connected && !isCurrentlyConnected && !studioScanPending) {
            // Plugin just connected! Trigger auto-scan by hitting the request endpoints
            Promise.all([
              fetch(`http://localhost:${port}/request-sounds`, { method: 'POST' }),
              fetch(`http://localhost:${port}/request-animations`, { method: 'POST' }),
              fetch(`http://localhost:${port}/request-images`, { method: 'POST' }),
              fetch(`http://localhost:${port}/request-meshes`, { method: 'POST' })
            ]).catch(() => {});
          }

          isCurrentlyConnected = connected;
          setStudioConnected(connected);
        })
        .catch(() => {
          isCurrentlyConnected = false;
          setStudioConnected(false);
        });
    };
    check();
    const id = setInterval(check, 5000);
    return () => clearInterval(id);
  }, [config.advanced.pluginPort]);



  const VALID_ROOT_SERVICES = new Set([
    'Workspace',
    'Lighting',
    'ReplicatedFirst',
    'ReplicatedStorage',
    'ServerScriptService',
    'ServerStorage',
    'StarterGui',
    'StarterPack',
    'StarterPlayer',
    'SoundService',
    'Teams',
    'MaterialService',
    'StudioSession', // virtual node for plugin data
  ]);

  const cleanRootInstances = rootInstances.filter(
    (node) => VALID_ROOT_SERVICES.has(node.className) || node.referent.startsWith('studio-'),
  );
  const displayedInstances = cleanRootInstances;

  // Shared helper — ingests a completed scan result into the Explorer tree
  const processStudioData = useCallback(
    (anims: any, sounds: any, images: any, meshes: any) => {
      const children: RbxInstance[] = [];
      if (anims.assets?.length > 0)
        children.push(pluginAssetsToNode('Animations', 'Model', anims.assets, 'animation'));
      if (sounds.assets?.length > 0)
        children.push(pluginAssetsToNode('Sounds', 'Model', sounds.assets, 'audio'));
      if (images.assets?.length > 0)
        children.push(pluginAssetsToNode('Images', 'Model', images.assets, 'image'));
      if (meshes.assets?.length > 0)
        children.push(pluginAssetsToNode('Meshes', 'Model', meshes.assets, 'mesh'));

      if (children.length === 0) return;

      const studioNode: RbxInstance = {
        referent: 'studio-root',
        className: 'StudioSession',
        name: 'Studio Session',
        assets: [],
        children,
      };

      setRootInstances((prev) => [
        studioNode,
        ...prev.filter((n) => n.referent !== 'studio-root'),
      ]);

      const allStudioIds: string[] = [];
      children.forEach((cat) => cat.assets.forEach((a) => allStudioIds.push(a.assetId)));
      setSelectedAssetIds((prev) => {
        const next = new Set(prev);
        allStudioIds.forEach((id) => next.add(id));
        return next;
      });

      setLoadedFileName((prev) => prev ?? 'Studio Session');

      const total = children.reduce((sum, c) => sum + c.assets.length, 0);
      logIsm('success', `Studio sync complete — ${total} assets loaded.`);
    },
    [setRootInstances, setSelectedAssetIds, setLoadedFileName],
  );

  // Persistent background auto-poll — picks up data whether the user pressed
  // "Sync from Studio" in the app OR "Scan Now" directly in Studio.
  // Each category is processed independently as soon as it arrives (complete:true)
  // so that parallel fetch timing differences don't cause the state to be missed.
  const autoPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pendingScanData = useRef<{
    anims?: any; sounds?: any; images?: any; meshes?: any;
  }>({});
  const scanTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!studioConnected) {
      if (autoPollRef.current) {
        clearInterval(autoPollRef.current);
        autoPollRef.current = null;
      }
      setStudioScanPending(false);
      return;
    }

    const port = config.advanced.pluginPort || '3100';
    const base = `http://localhost:${port}`;

    autoPollRef.current = setInterval(async () => {
      try {
        const [anims, sounds, images, meshes] = await Promise.all([
          fetch(`${base}/last-animations`).then((r) => r.json()),
          fetch(`${base}/last-sounds`).then((r) => r.json()),
          fetch(`${base}/last-images`).then((r) => r.json()),
          fetch(`${base}/last-meshes`).then((r) => r.json()),
        ]);

        // Accumulate each category the moment it completes
        if (anims.complete) pendingScanData.current.anims = anims;
        if (sounds.complete) pendingScanData.current.sounds = sounds;
        if (images.complete) pendingScanData.current.images = images;
        if (meshes.complete) pendingScanData.current.meshes = meshes;

        // A scan is in progress if any category is scanning
        const scanning = anims.scanning || sounds.scanning || images.scanning || meshes.scanning;
        if (scanning) {
          setStudioScanPending(true);
          // Reset watchdog
          if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current);
          scanTimeoutRef.current = setTimeout(() => {
            setStudioScanPending(false);
            pendingScanData.current = {};
          }, 300000); // 5 minutes
          return;
        }

        // All 4 categories have arrived — process together
        const pd = pendingScanData.current;
        if (pd.anims && pd.sounds && pd.images && pd.meshes) {
          processStudioData(pd.anims, pd.sounds, pd.images, pd.meshes);
          pendingScanData.current = {};
          setStudioScanPending(false);
          if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current);
        } else if (pd.anims || pd.sounds || pd.images || pd.meshes) {
          // Partial data — check if we've been waiting a while; if so fire with what we have
          const haveAtLeastOne = pd.anims || pd.sounds || pd.images || pd.meshes;
          if (haveAtLeastOne && !anims.scanning && !sounds.scanning && !images.scanning && !meshes.scanning) {
            processStudioData(
              pd.anims ?? { assets: [] },
              pd.sounds ?? { assets: [] },
              pd.images ?? { assets: [] },
              pd.meshes ?? { assets: [] },
            );
            pendingScanData.current = {};
            setStudioScanPending(false);
            if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current);
          }
        }
      } catch {
        // Server temporarily unreachable — keep polling
      }
    }, 2000);

    return () => {
      if (autoPollRef.current) {
        clearInterval(autoPollRef.current);
        autoPollRef.current = null;
      }
      if (scanTimeoutRef.current) {
        clearTimeout(scanTimeoutRef.current);
        scanTimeoutRef.current = null;
      }
    };
  }, [studioConnected, config.advanced.pluginPort, processStudioData]);


  const toggleAsset = (assetId: string, checked: boolean) => {
    setSelectedAssetIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(assetId);
      else next.delete(assetId);
      return next;
    });
  };

  const getAllAssetIds = (node: RbxInstance): string[] => {
    let ids: string[] = node.assets
      .filter((a) => activeAssetFilters.includes(a.type))
      .map((a) => getAssetId(a))
      .filter(Boolean);
    for (const child of node.children) {
      ids = ids.concat(getAllAssetIds(child));
    }
    return ids;
  };

  const toggleNode = (node: RbxInstance, checked: boolean) => {
    const allIds = getAllAssetIds(node);
    setSelectedAssetIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        allIds.forEach((id) => next.add(id));
      } else {
        allIds.forEach((id) => next.delete(id));
      }
      return next;
    });
  };

  const unlistenRef = useRef<(() => void) | null>(null);

  /** Load and parse a place file from a filesystem path */
  const loadFromPath = async (filePath: string) => {
    const fileName = filePath.replace(/\\/g, '/').split('/').pop() || filePath;
    if (!fileName.endsWith('.rbxl') && !fileName.endsWith('.rbxlx')) {
      logIsm('warn', `Only .rbxl and .rbxlx files are supported. Got: "${fileName}"`);
      return;
    }
    setParsingFileName(fileName);
    setParseState({ phase: 'Reading file', current: 0, total: 1 });
    try {
      const fileUrl = convertFileSrc(filePath);
      const result = await parsePlaceUrlInWorker(fileUrl, fileName, setParseState);

      for (const w of result.warnings) {
        logIsm('warn', w);
      }

      const getAllAssetsFlat = (nodes: RbxInstance[]): ParsedAssetRef[] => {
        let all: ParsedAssetRef[] = [];
        for (const node of nodes) {
          all = all.concat(node.assets);
          all = all.concat(getAllAssetsFlat(node.children));
        }
        return all;
      };

      const allTreeAssets = getAllAssetsFlat(result.rootInstances);
      const allIds = allTreeAssets.map((a) => getAssetId(a)).filter(Boolean);
      setSelectedAssetIds(new Set(allIds));

      setRootInstances(result.rootInstances);
      setLoadedFileName(fileName);

      let totalAssets = 0;
      const countAssets = (node: RbxInstance) => {
        totalAssets += node.assets.length;
        node.children.forEach(countAssets);
      };
      result.rootInstances.forEach(countAssets);

      logIsm(
        'success',
        `Loaded "${fileName}" - ${totalAssets} asset reference${totalAssets !== 1 ? 's' : ''}.`,
      );
    } catch (err) {
      logIsm('error', `Failed to read "${fileName}": ${String(err)}`);
    } finally {
      setParseState(null);
      setParsingFileName(null);
    }
  };

  /** Set up the Tauri native drag-drop listener */
  useEffect(() => {
    let cancelled = false;
    getCurrentWindow()
      .onDragDropEvent((event) => {
        if (cancelled) return;
        const { type } = event.payload;
        if (type === 'enter' || type === 'over') {
          setIsDragOver(true);
        } else if (
          type === 'leave' ||
          (type as string) === 'cancelled' ||
          (type as string) === 'dropCancelled'
        ) {
          setIsDragOver(false);
        } else if (type === 'drop') {
          setIsDragOver(false);
          const paths: string[] = (event.payload as any).paths ?? [];
          const placeFile = paths.find((p) => p.endsWith('.rbxl') || p.endsWith('.rbxlx'));
          if (placeFile) {
            loadFromPath(placeFile);
          } else if (paths.length > 0) {
            logIsm('warn', `Only .rbxl and .rbxlx files are supported.`);
          }
        }
      })
      .then((unlisten) => {
        if (cancelled) {
          unlisten();
        } else {
          unlistenRef.current = unlisten;
        }
      });

    return () => {
      cancelled = true;
      unlistenRef.current?.();
      unlistenRef.current = null;
    };
  }, []);

  /** Open system file picker - .rbxl / .rbxlx only */
  const handleBrowse = async () => {
    try {
      const selected = await openFilePicker({
        multiple: false,
        filters: [{ name: 'Roblox Place', extensions: ['rbxl', 'rbxlx'] }],
      });
      if (!selected) return;
      const filePath = typeof selected === 'string' ? selected : (selected as any).path;
      if (filePath) await loadFromPath(filePath);
    } catch (err) {
      if (String(err).toLowerCase().includes('cancel')) return;
      logIsm('error', `File picker error: ${String(err)}`);
    }
  };

  return (
    <motion.div
      initial={{ x: 30, opacity: 0 }}
      animate={{
        x: 0,
        opacity: isOpen ? 1 : 0,
        width: isOpen ? 288 : 0,
      }}
      transition={{ type: 'spring', stiffness: 350, damping: 35 }}
      className="h-full bg-bg-surface border-l border-border-subtle flex flex-col shrink-0 overflow-hidden relative"
    >
      {/* Native drag-drop overlay (shown when file is dragged over the OS window) */}
      <AnimatePresence>
        {isDragOver && isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex items-center justify-center bg-bg-surface/90 backdrop-blur-sm border-2 border-dashed border-primary m-1 rounded-[var(--radius-md)] pointer-events-none"
          >
            <div className="flex flex-col items-center gap-3 text-primary">
              <FileUp size={28} />
              <span className="font-semibold text-sm">Drop .rbxl / .rbxlx</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="h-12 border-b border-border-subtle flex items-center justify-between px-2 shrink-0">
        <AnimatePresence mode="wait">
          {isOpen && (
            <motion.div
              key="title"
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: 'auto' }}
              exit={{ opacity: 0, width: 0 }}
              className="flex items-center gap-2 pl-1 overflow-hidden"
            >
              <span className="text-sm font-bold tracking-wide text-text-primary whitespace-nowrap">
                Explorer
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex items-center gap-1.5 justify-end z-[100]">
          <AnimatePresence>
            {isOpen && loadedFileName && (
              <motion.div
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 128 }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: 0.2, ease: 'easeInOut' }}
                className="overflow-hidden"
              >
                <div className="w-32">
                  <MultiSelectDropdown
                    options={ASSET_TYPE_OPTIONS}
                    values={activeAssetFilters}
                    onChange={setActiveAssetFilters}
                    placeholder="Filter Types"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <Button
            isIconOnly
            variant="ghost"
            size="sm"
            className="h-7 w-7 min-w-7 text-text-secondary hover:text-text-primary"
            onClick={() => setIsOpen(!isOpen)}
          >
            {isOpen ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </Button>
        </div>
      </div>

      {/* Body */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 overflow-y-auto scrollbar-hide w-72 flex flex-col"
          >
            {parseState ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 text-text-muted px-6">
                <Spinner size="sm" color="current" />
                <div className="flex flex-col items-center text-center gap-1">
                  <span className="text-xs font-semibold text-text-primary">
                    {parseState.phase}
                  </span>
                  {parseState.total > 1 && (
                    <span className="text-[10px]">
                      {Math.round((parseState.current / parseState.total) * 100)}% (
                      {parseState.phase === 'Reading file'
                        ? `${(parseState.current / 1048576).toFixed(1)}MB / ${(parseState.total / 1048576).toFixed(1)}MB`
                        : `${parseState.current} / ${parseState.total}`}
                      )
                    </span>
                  )}
                  {parseState.eta && (
                    <span className="text-[10px] text-primary/80 font-medium">
                      ETA: {parseState.eta}
                    </span>
                  )}
                </div>
              </div>
            ) : displayedInstances.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1, duration: 0.35 }}
                className="flex-1 flex flex-col"
              >
                <div className="flex-1 flex items-center justify-center">
                  {studioScanPending ? (
                    <span className="flex items-center gap-2 text-primary/80 text-xs font-medium select-none">
                      <Spinner size="sm" color="current" />
                      Scanning...
                    </span>
                  ) : (
                    <span className="text-text-muted/60 text-xs font-medium select-none">
                      {studioConnected ? 'Waiting for Studio scan...' : 'No place loaded'}
                    </span>
                  )}
                </div>
                {/* Clickable drop zone */}
                <div
                  className="tour-asset-explorer-dropzone mx-3 mb-3 h-28 flex-shrink-0 flex flex-col items-center justify-center gap-2 rounded-[var(--radius-lg)] border-2 border-dashed border-border-strong hover:border-primary/60 hover:bg-primary/5 transition-colors cursor-pointer text-text-muted hover:text-primary select-none"
                  onClick={handleBrowse}
                >
                  <FolderOpen size={24} className="opacity-60" />
                  <div className="text-center px-4">
                    <p className="text-[11px] font-semibold">Drop or click to browse</p>
                    <p className="text-[9px] mt-1 opacity-60">.rbxl &amp; .rbxlx only</p>
                  </div>
                </div>
              </motion.div>
            ) : (
              <div className="flex flex-col h-full">
                {loadedFileName && (
                  <div className="px-3 pt-3 pb-1 flex items-center gap-2 text-[10px] text-text-muted">
                    <FolderOpen size={11} />
                    <span className="truncate font-medium">{loadedFileName}</span>
                  </div>
                )}
                <div className="flex flex-col flex-1 p-1">
                  {displayedInstances.map((node, i) => (
                    <RbxNode
                      key={`${node.referent}-${i}`}
                      node={node}
                      level={0}
                      config={config}
                      selectedAssetIds={selectedAssetIds}
                      toggleAsset={toggleAsset}
                      toggleNode={toggleNode}
                      getAllAssetIds={getAllAssetIds}
                      setEnlargedImage={setEnlargedImage}
                      setPlayingVideo={setPlayingVideo}
                      setPreviewingAnimation={setPreviewingAnimation}
                      activeAssetFilters={activeAssetFilters}
                    />
                  ))}
                </div>
                <Button
                  onClick={handleBrowse}
                  variant="flat"
                  className="mx-3 mb-3 mt-1 text-[11px]"
                >
                  Load a different file
                </Button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {enlargedImage && (
          <ImageOverlay assetId={enlargedImage.id} onClose={() => setEnlargedImage(null)} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {playingVideo && (
          <VideoOverlay assetId={playingVideo} onClose={() => setPlayingVideo(null)} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {previewingAnimation && (
          <AnimationPreview
            assetId={previewingAnimation.id}
            assetName={previewingAnimation.name}
            onClose={() => setPreviewingAnimation(null)}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function ImageOverlay({ assetId, onClose }: { assetId: string; onClose: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!window.tauriAPI?.fetchRobloxThumbnail) {
      setError(true);
      return;
    }
    window.tauriAPI
      .fetchRobloxThumbnail(assetId)
      .then((fetchedUrl) => {
        if (fetchedUrl) {
          setUrl(fetchedUrl);
        } else {
          setError(true);
        }
      })
      .catch(() => setError(true));
  }, [assetId]);

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-[9999] bg-black/85 backdrop-blur-md flex items-center justify-center p-6 md:p-12 cursor-zoom-out pointer-events-auto"
    >
      <button
        className="absolute top-6 right-6 p-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors z-10"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
      >
        <X size={24} />
      </button>
      <div className="relative w-full h-full flex items-center justify-center">
        {url ? (
          <motion.img
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            src={url}
            alt="Enlarged asset"
            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl border border-white/10"
            onClick={(e) => e.stopPropagation()}
          />
        ) : error ? (
          <div className="text-white bg-red-500/20 px-4 py-2 rounded text-sm font-medium">
            Failed to load image
          </div>
        ) : (
          <Spinner size="lg" />
        )}
      </div>
    </motion.div>,
    document.body,
  );
}

function VideoOverlay({ assetId, onClose }: { assetId: string; onClose: () => void }) {
  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-[9999] bg-black/85 backdrop-blur-md flex items-center justify-center p-6 md:p-12 cursor-zoom-out pointer-events-auto"
    >
      <button
        className="absolute top-6 right-6 p-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors z-10"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
      >
        <X size={24} />
      </button>
      <div className="relative w-full max-w-4xl max-h-full flex items-center justify-center">
        <video
          src={`https://assetdelivery.roblox.com/v1/asset/?id=${assetId}`}
          controls
          autoPlay
          className="w-full h-full object-contain rounded-lg shadow-2xl border border-white/10"
          onClick={(e) => e.stopPropagation()}
        />
      </div>
    </motion.div>,
    document.body,
  );
}

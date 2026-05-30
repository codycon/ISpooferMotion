import { invoke } from '@tauri-apps/api/core';
import { AnimatePresence, motion } from 'framer-motion';
import { DownloadCloud } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useConfig } from '../../contexts/ConfigContext';
import {
  Button,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  StatusPill,
} from '../../ism-library';

export default function StatusBar() {
  const { config } = useConfig();
  const [updateInfo, setUpdateInfo] = useState<any>(null);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [appVersion, setAppVersion] = useState<string>('');

  useEffect(() => {
    if (!config.general.autoUpdate) {
      setUpdateInfo(null);
      return;
    }

    const checkUpdates = () => {
      invoke('check_for_updates')
        .then((info: any) => {
          if (info?.has_update) {
            setUpdateInfo(info);
            if (!sessionStorage.getItem('ism_has_prompted_update')) {
              sessionStorage.setItem('ism_has_prompted_update', 'true');
              setIsUpdateModalOpen(true);
            }
          }
        })
        .catch((err) => console.warn('Silent update check failed:', err));
    };

    checkUpdates();
    const interval = setInterval(checkUpdates, 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, [config.general.autoUpdate]);

  const [studioConnected, setStudioConnected] = useState(false);

  useEffect(() => {
    const port = config.advanced.pluginPort || '3100';
    const check = () => {
      fetch(`http://localhost:${port}/health`, { signal: AbortSignal.timeout(800) })
        .then((res) => res.json())
        .then((data) => setStudioConnected(data.plugin_connected === true))
        .catch(() => setStudioConnected(false));
    };
    check();
    const id = setInterval(check, 5000);
    return () => clearInterval(id);
  }, [config.advanced.pluginPort]);

  useEffect(() => {
    invoke<string>('get_app_version')
      .then((v) => setAppVersion(v))
      .catch(() => setAppVersion(''));
  }, []);

  const handleUpdateClick = () => {
    if (!updateInfo) return;
    setIsUpdateModalOpen(true);
  };

  const handleConfirmUpdate = async () => {
    setIsUpdateModalOpen(false);
    invoke('download_and_install_plugin', {
      pluginUrl: updateInfo.plugin_url,
      appUrl: updateInfo.app_url,
    }).catch((e) => {
      console.error('Failed to trigger update download:', e);
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.4, ease: 'easeOut' }}
      className="h-8 w-full bg-transparent border-t border-border-subtle flex items-center justify-between px-4 shrink-0 z-50 select-none"
    >
      <div className="flex items-center gap-2">
        <span className={`text-[11px] font-bold tracking-wide ${studioConnected ? 'text-primary' : 'text-text-muted/60'}`}>
          {studioConnected ? 'Synced to Studio' : 'Not synced to Studio'}
        </span>
      </div>

      <div className="flex items-center gap-3">
        <AnimatePresence>
          {updateInfo && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              onClick={handleUpdateClick}
              className="flex items-center gap-1.5 px-2 py-0.5 rounded text-text-primary hover:text-success hover:bg-success/10 transition-colors cursor-pointer group"
            >
              <DownloadCloud size={14} className="group-hover:scale-110 transition-transform" />
              <span className="text-[10px] font-bold tracking-widest uppercase">Update</span>
            </motion.button>
          )}
        </AnimatePresence>
        <span className="text-[10px] text-text-muted font-mono">
          {appVersion ? `v${appVersion}` : 'v?'}
        </span>
      </div>

      <Modal isOpen={isUpdateModalOpen} onOpenChange={setIsUpdateModalOpen} size="sm">
        <ModalContent>
          <ModalHeader>Update Available</ModalHeader>
          <ModalBody>
            <p className="font-medium text-text-primary">
              Version {updateInfo?.latest_version} is available.
            </p>
            <p className="mt-2 text-sm text-text-muted">
              Do you want to download and install it now? The application will automatically restart
              after the download is complete.
            </p>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" onClick={() => setIsUpdateModalOpen(false)}>
              Skip for now
            </Button>
            <Button variant="solid" onClick={handleConfirmUpdate}>
              Update
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </motion.div>
  );
}

import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { Window, getCurrentWindow } from '@tauri-apps/api/window';
import { AnimatePresence, motion } from 'framer-motion';
import { DownloadCloud, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import appIcon from '../../assets/app_icon.png';
import { Button, Progress, Spinner } from '../../ism-library';

const isAutoUpdateEnabled = () => {
  try {
    const saved = localStorage.getItem('ISpooferMotion_Config');
    if (!saved) return false;
    const parsed = JSON.parse(saved);
    return parsed?.general?.autoUpdate === true;
  } catch {
    return false;
  }
};

interface SplashLoaderProps {
  handoffWindow?: boolean;
}

export default function SplashLoader({ handoffWindow = false }: SplashLoaderProps) {
  const [phase, setPhase] = useState('checking');
  const [status, setStatus] = useState('Verifying files...');
  const [progress, setProgress] = useState(0);
  const [pluginUrl, setPluginUrl] = useState('');
  const [appUrl, setAppUrl] = useState('');
  const [latestVersion, setLatestVersion] = useState('');

  useEffect(() => {
    if (!handoffWindow) return;
    if (phase !== 'checking') return;

    let isMounted = true;

    const checkUpdates = async () => {
      setProgress(15);
      setStatus('Verifying files...');

      if (!isAutoUpdateEnabled()) {
        setProgress(100);
        setStatus('Launching...');
        setTimeout(handleComplete, 450);
        return;
      }

      try {
        await new Promise((r) => setTimeout(r, 600));
        setProgress(45);
        setStatus('Checking for updates...');

        const info: any = await invoke('check_for_updates');

        if (!isMounted) return;

        if (info.has_update) {
          setProgress(85);
          setStatus('New update found!');
          setLatestVersion(info.latest_version);
          setPluginUrl(info.plugin_url);
          setAppUrl(info.app_url);
          setTimeout(() => {
            if (isMounted) setPhase('prompt');
          }, 1000);
        } else {
          setProgress(100);
          setStatus('Launching...');
          setTimeout(handleComplete, 800);
        }
      } catch (e) {
        console.error('Update check failed:', e);
        if (!isMounted) return;
        setProgress(100);
        setStatus('Launching...');
        setTimeout(handleComplete, 800);
      }
    };

    checkUpdates();

    return () => {
      isMounted = false;
    };
  }, [handoffWindow, phase]);

  useEffect(() => {
    if (!handoffWindow) return;
    if (phase !== 'downloading') return;
    let isMounted = true;
    let unlisten: () => void;

    const downloadUpdate = async () => {
      setStatus(`Downloading update v${latestVersion}...`);
      setProgress(0);

      try {
        unlisten = await listen('download-progress', (event) => {
          if (isMounted) {
            setProgress(event.payload as number);
            if ((event.payload as number) >= 90) {
              setStatus('Installing plugin...');
            }
          }
        });

        await invoke('download_and_install_plugin', { pluginUrl, appUrl });

        if (!isMounted) return;
        setStatus('Launching...');
        setProgress(100);
        setTimeout(handleComplete, 800);
      } catch (e) {
        console.error('Download failed:', e);
        if (!isMounted) return;
        setStatus('Launching...');
        setProgress(100);
        setTimeout(handleComplete, 800);
      }
    };

    downloadUpdate();

    return () => {
      isMounted = false;
      if (unlisten) unlisten();
    };
  }, [handoffWindow, phase, latestVersion, pluginUrl, appUrl]);

  const handleComplete = async () => {
    try {
      if (!handoffWindow) return;
      const mainWindow = await Window.getByLabel('main');
      if (mainWindow) {
        await mainWindow.show();
      }

      const current = getCurrentWindow();
      await current.close();
    } catch (e) {
      console.error('Failed to swap windows:', e);
    }
  };

  const handleCancel = () => {
    setStatus('Launching...');
    setProgress(100);
    setTimeout(handleComplete, 400);
  };

  const handleDownload = () => {
    setPhase('downloading');
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15,
        delayChildren: 0.1,
      },
    },
  };

  const itemVariants: any = {
    hidden: { opacity: 0, y: 20, filter: 'blur(8px)' },
    visible: {
      opacity: 1,
      y: 0,
      filter: 'blur(0px)',
      transition: { type: 'spring', stiffness: 300, damping: 24 },
    },
  };

  return (
    <div
      data-tauri-drag-region
      className="fixed inset-0 z-[100] flex items-center justify-center bg-bg-base select-none overflow-hidden rounded-xl"
    >
      <AnimatePresence mode="wait">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="z-10 flex flex-col items-center justify-center overflow-hidden relative w-full h-full px-8 pointer-events-none"
        >
          <motion.div variants={itemVariants} className="mb-6 relative">
            <div className="absolute inset-0 bg-foreground/5 rounded-full blur-xl transform scale-110 -z-10"></div>
            <img src={appIcon} alt="Logo" className="w-24 h-24 object-contain drop-shadow-2xl" />
          </motion.div>

          <motion.h1
            variants={itemVariants}
            className="text-2xl font-bold tracking-tighter mb-8 text-text-primary"
          >
            ISpooferMotion
          </motion.h1>

          <motion.div
            variants={itemVariants}
            className="w-full flex flex-col items-center min-h-[80px] justify-center max-w-[320px] pointer-events-auto"
          >
            <AnimatePresence mode="wait">
              {phase === 'prompt' ? (
                <motion.div
                  key="prompt"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  className="flex flex-col w-full items-center gap-5"
                >
                  <span className="text-sm font-semibold text-text-primary tracking-wide">
                    Update v{latestVersion} available
                  </span>
                  <div className="flex w-full gap-3">
                    <Button
                      variant="ghost"
                      className="flex-1 font-medium text-text-secondary hover:bg-border-subtle hover:text-text-primary transition-colors"
                      onClick={handleCancel}
                      startContent={<X size={16} />}
                    >
                      Skip
                    </Button>
                    <Button
                      variant="solid"
                      className="flex-1 font-bold shadow-elevated"
                      onClick={handleDownload}
                      startContent={<DownloadCloud size={16} />}
                    >
                      Update
                    </Button>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="w-full flex flex-col items-center gap-3"
                >
                  <div className="flex w-full justify-between items-center px-1">
                    <span className="text-[10px] font-semibold text-text-muted uppercase tracking-widest">
                      {status}
                    </span>
                    {phase === 'downloading' ? (
                      <span className="text-[10px] font-extrabold tracking-widest tabular-nums text-text-primary">
                        {progress}%
                      </span>
                    ) : (
                      <Spinner size="sm" color="current" className="text-text-primary" />
                    )}
                  </div>

                  <div className="relative w-full h-1.5">
                    <Progress value={progress} color="default" className="w-full" />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

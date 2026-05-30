// Toast notification system.
// You need to put <ToastProvider /> somewhere high up in your component tree (like App.tsx).
// It manages the active toasts and handles their auto-dismiss timers.

import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';
import { useEffect, useState, useRef } from 'react';

interface WarningToast {
  id: number;
  message: string;
  count: number;
  timestamp: number;
}

const TOAST_DURATION_MS = 4200;

declare global {
  interface WindowEventMap {
    'ism-warning-toast': CustomEvent<{ message: string }>;
  }
}

export function ToastProvider() {
  const [toasts, setToasts] = useState<WarningToast[]>([]);
  const timeoutsRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    const removeToast = (id: number) => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
      timeoutsRef.current.delete(id);
    };

    const handleToast = (event: WindowEventMap['ism-warning-toast']) => {
      const msg = event.detail.message;
      const now = Date.now();

      setToasts((current) => {
        const existing = current.find((t) => t.message === msg);
        if (existing) {
          // Clear old timeout
          const oldTimeout = timeoutsRef.current.get(existing.id);
          if (oldTimeout) clearTimeout(oldTimeout);

          // Set new timeout
          const newTimeout = setTimeout(() => removeToast(existing.id), TOAST_DURATION_MS);
          timeoutsRef.current.set(existing.id, newTimeout);

          // Update count and timestamp without changing id (so it stays in place)
          return current.map((t) =>
            t.id === existing.id ? { ...t, count: t.count + 1, timestamp: now } : t,
          );
        } else {
          const id = now + Math.random();
          const newTimeout = setTimeout(() => removeToast(id), TOAST_DURATION_MS);
          timeoutsRef.current.set(id, newTimeout);

          // Add new toast and slice to max 4
          return [...current, { id, message: msg, count: 1, timestamp: now }].slice(-4);
        }
      });
    };

    window.addEventListener('ism-warning-toast', handleToast);
    return () => {
      window.removeEventListener('ism-warning-toast', handleToast);
      // Clean up timeouts on unmount
      timeoutsRef.current.forEach((timeout) => clearTimeout(timeout));
    };
  }, []);

  return (
    <div className="fixed right-4 bottom-12 z-[10000] flex w-[340px] max-w-[calc(100vw-2rem)] flex-col gap-2 pointer-events-none">
      <AnimatePresence initial={false}>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, x: 24, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
            exit={{ opacity: 0, x: 24, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            role="button"
            tabIndex={0}
            onClick={() => {
              setToasts((current) => current.filter((item) => item.id !== toast.id));
              const t = timeoutsRef.current.get(toast.id);
              if (t) clearTimeout(t);
              timeoutsRef.current.delete(toast.id);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                setToasts((current) => current.filter((item) => item.id !== toast.id));
                const t = timeoutsRef.current.get(toast.id);
                if (t) clearTimeout(t);
                timeoutsRef.current.delete(toast.id);
              }
            }}
            className="pointer-events-auto cursor-pointer overflow-hidden rounded-2xl border border-border-subtle bg-bg-surface/70 shadow-2xl backdrop-blur-2xl transition-transform hover:scale-[1.02] active:scale-95 flex flex-col"
          >
            <div className="flex items-center gap-3.5 px-4 py-3.5">
              <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-warning/10 text-warning">
                <svg
                  key={toast.timestamp}
                  className="absolute inset-0 h-full w-full -rotate-90"
                  viewBox="0 0 32 32"
                >
                  <motion.circle
                    cx="16"
                    cy="16"
                    r="15"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeDasharray="94.248"
                    initial={{ strokeDashoffset: 0 }}
                    animate={{ strokeDashoffset: 94.248 }}
                    transition={{ duration: TOAST_DURATION_MS / 1000, ease: 'linear' }}
                    className="opacity-50"
                  />
                </svg>
                <AlertTriangle size={15} strokeWidth={2.5} className="z-10" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-semibold text-text-primary leading-tight shadow-sm">
                  {toast.message}{' '}
                  {toast.count > 1 && <span className="text-text-muted">({toast.count})</span>}
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

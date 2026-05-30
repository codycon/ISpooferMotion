import { listen } from '@tauri-apps/api/event';
import React, { useEffect } from 'react';
import { ThemeProvider as UIThemeProvider, useThemeAccent } from '../ism-library';
import type { ThemeConfig } from '../ism-library/theme/ThemeProvider';

const isTauriRuntime = () => {
  const internals = (window as any).__TAURI_INTERNALS__;
  return Boolean(
    internals &&
    typeof internals.invoke === 'function' &&
    typeof internals.transformCallback === 'function',
  );
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <UIThemeProvider>
      <TauriThemeListener />
      {children}
    </UIThemeProvider>
  );
};

const TauriThemeListener = () => {
  const { loadThemeFromJson, setThemeMode } = useThemeAccent();

  useEffect(() => {
    let unlisten: Promise<() => void> | null = null;
    if (isTauriRuntime()) {
      unlisten = listen<string>('theme-updated', (event) => {
        loadThemeFromJson(event.payload);
        setThemeMode('custom');
      });
    }

    return () => {
      unlisten?.then((f) => f()).catch(() => {});
    };
  }, [loadThemeFromJson, setThemeMode]);

  return null;
};

export { useThemeAccent };
export type { ThemeConfig };

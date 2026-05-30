import { invoke } from '@tauri-apps/api/core';

export type LogLevel = 'info' | 'success' | 'warn' | 'error';
export type LogSource = 'console' | 'ism';

export interface LogEntry {
  id: number;
  level: LogLevel;
  source: LogSource;
  message: string;
  timestamp: string;
}

const MAX_LOGS = 1000;

type Listener = (logs: LogEntry[]) => void;

interface DebugLoggerState {
  logs: LogEntry[];
  counter: number;
  listeners: Set<Listener>;
  patched: boolean;
  originals?: {
    log: typeof console.log;
    info: typeof console.info;
    debug: typeof console.debug;
    warn: typeof console.warn;
    error: typeof console.error;
    success: (...args: any[]) => void;
  };
}

declare global {
  interface Window {
    ismLog: (level: LogLevel, message: string, notify?: boolean) => void;
    __ismDebugLogger?: DebugLoggerState;
  }

  interface WindowEventMap {
    'ism-warning-toast': CustomEvent<{ message: string }>;
  }
}

function getState(): DebugLoggerState {
  if (!window.__ismDebugLogger) {
    window.__ismDebugLogger = {
      logs: [],
      counter: 0,
      listeners: new Set(),
      patched: false,
    };
  }
  return window.__ismDebugLogger;
}

function formatArg(arg: any): string {
  if (arg instanceof Error) {
    return arg.stack || arg.message;
  }
  if (typeof arg === 'string') {
    return arg;
  }
  try {
    return typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg);
  } catch {
    return String(arg);
  }
}

export function addDebugLog(
  level: LogLevel,
  args: any[],
  source: LogSource = 'console',
  notify: boolean = false,
) {
  const state = getState();
  const entry: LogEntry = {
    id: state.counter++,
    level,
    source,
    message: args.map(formatArg).join(' '),
    timestamp: new Date().toLocaleTimeString([], { hour12: false }),
  };

  state.logs = [...state.logs, entry].slice(-MAX_LOGS);
  state.listeners.forEach((listener) => listener(state.logs));

  if (level === 'warn') {
    window.dispatchEvent(
      new CustomEvent('ism-warning-toast', { detail: { message: entry.message } }),
    );
  }

  if (notify && (level === 'success' || level === 'error')) {
    try {
      const configStr = localStorage.getItem('ISpooferMotion_Config');
      if (configStr) {
        const config = JSON.parse(configStr);
        if (config?.general?.desktopNotifications) {
          invoke('show_notification', {
            options: {
              title: level === 'success' ? 'ISpooferMotion - Success' : 'ISpooferMotion - Error',
              body: entry.message,
            },
          }).catch(() => {});
        }
      }
    } catch (e) {
      // Ignore
    }
  }
}

export function subscribeDebugLogs(listener: Listener) {
  const state = getState();
  state.listeners.add(listener);
  listener(state.logs);
  return () => {
    state.listeners.delete(listener);
  };
}

export function getDebugLogs() {
  return getState().logs;
}

export function clearDebugLogs() {
  const state = getState();
  state.logs = [];
  state.listeners.forEach((listener) => listener([]));
}

export function installDebugLogger() {
  const state = getState();
  if (state.patched) return;

  const originals = {
    log: console.log.bind(console),
    info: console.info.bind(console),
    debug: console.debug.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
    success: ((console as any).success || console.info).bind(console),
  };
  state.originals = originals;
  state.patched = true;

  console.log = (...args) => {
    originals.log(...args);
    addDebugLog('info', args, 'console');
  };
  console.info = (...args) => {
    originals.info(...args);
    addDebugLog('info', args, 'console');
  };
  console.debug = (...args) => {
    originals.debug(...args);
    addDebugLog('info', args, 'console');
  };
  (console as any).success = (...args: any[]) => {
    originals.success(...args);
    addDebugLog('success', args, 'console');
  };
  console.warn = (...args) => {
    originals.warn(...args);
    addDebugLog('warn', args, 'console');
  };
  console.error = (...args) => {
    originals.error(...args);
    addDebugLog('error', args, 'console');
  };

  window.addEventListener('error', (event) => {
    addDebugLog('error', [event.error || event.message || 'Unhandled window error'], 'console');
  });
  window.addEventListener('unhandledrejection', (event) => {
    addDebugLog('error', [event.reason || 'Unhandled promise rejection'], 'console');
  });

  window.ismLog = (level: LogLevel, message: string, notify?: boolean) => {
    addDebugLog(level, [message], 'ism', notify);
  };
}

installDebugLogger();

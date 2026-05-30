import React from 'react';
import { ThemeConfig } from '../../../contexts/ThemeContext';

export const DEFAULT_THEME_JSON = `{
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
    "content3": "#ffffff0d",
    "border": "#ffffff1a",
    "primary": "#10b981",
    "secondary": "#8b8b9c",
    "success": "#4ade80",
    "warning": "#fbbf24",
    "danger": "#f87171",
    "default": "#58586a"
  },
  "style": {
    "border_radius": "10px",
    "blur": "8px",
    "app_opacity": "1",
    "shadow": "0 20px 64px rgba(0, 0, 0, 0.72), 0 8px 20px rgba(0, 0, 0, 0.4)"
  }
}`;

export const DEFAULT_THEME_OBJ: ThemeConfig = JSON.parse(DEFAULT_THEME_JSON);

export const SHADOW_PRESETS = [
  { label: 'None', value: 'none' },
  { label: 'Small', value: '0 4px 12px rgba(0, 0, 0, 0.3)' },
  { label: 'Medium', value: '0 8px 24px rgba(0, 0, 0, 0.5)' },
  { label: 'Large', value: '0 20px 64px rgba(0, 0, 0, 0.72), 0 8px 20px rgba(0, 0, 0, 0.4)' },
];

export const RADIUS_PRESETS = [
  { label: 'Square (0px)', value: '0px' },
  { label: 'Small (4px)', value: '4px' },
  { label: 'Medium (10px)', value: '10px' },
  { label: 'Large (16px)', value: '16px' },
  { label: 'Pill (99px)', value: '9999px' },
];

export const BLUR_PRESETS = [
  { label: 'None', value: '0px' },
  { label: 'Light (4px)', value: '4px' },
  { label: 'Medium (8px)', value: '8px' },
  { label: 'Heavy (16px)', value: '16px' },
];

export function isTauriRuntime() {
  const internals = (window as any).__TAURI_INTERNALS__;
  return Boolean(
    internals &&
    typeof internals.invoke === 'function' &&
    typeof internals.transformCallback === 'function',
  );
}

export function percentLabel(value: string | undefined, fallback = '1') {
  return `${Math.round(parseFloat(value ?? fallback) * 100)}%`;
}

export function rangeStyle(value: string | undefined, min: number, max: number, fallback = '1') {
  const numericValue = Number.parseFloat(value ?? fallback);
  const clamped = Math.min(max, Math.max(min, Number.isFinite(numericValue) ? numericValue : max));
  const progress = ((clamped - min) / (max - min)) * 100;
  return { '--range-progress': `${progress}%` } as React.CSSProperties;
}

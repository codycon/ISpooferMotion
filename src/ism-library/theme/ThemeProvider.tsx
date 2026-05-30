import React, { createContext, useContext, useEffect, useState } from 'react';

function generateColorVars(hex: string, prefix: string = 'primary') {
  return {
    [`--${prefix}`]: hex,
  };
}

interface CustomBackground {
  type: 'image' | 'video';
  path: string;
}

export interface ThemeConfig {
  name?: string;
  colors?: Record<string, string>;
  background?: {
    image?: string;
    video?: string;
  };
  style?: {
    border_radius?: string;
    blur?: string;
    shadow?: string;
    app_opacity?: string;
  };
  logo?: {
    image?: string;
    opacity?: string;
  };
}

export interface CustomLogo {
  image?: string;
  opacity?: string;
}

interface ThemeContextType {
  accentColor: string;
  setAccentColor: (hex: string) => void;
  customBackground: CustomBackground | null;
  setCustomBackground: (bg: CustomBackground | null) => void;
  customLogo: CustomLogo | null;
  loadThemeFromJson: (jsonString: string) => boolean;
  clearCustomTheme: () => void;
  themeMode: string;
  setThemeMode: (mode: string) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  accentColor: '#10b981',
  setAccentColor: () => {},
  customBackground: null,
  setCustomBackground: () => {},
  customLogo: null,
  loadThemeFromJson: () => false,
  clearCustomTheme: () => {},
  themeMode: 'dark',
  setThemeMode: () => {},
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [accentColor, setAccentColorState] = useState<string>('#10b981');
  const [customBackground, setCustomBackgroundState] = useState<CustomBackground | null>(null);
  const [customLogoState, setCustomLogoState] = useState<CustomLogo | null>(null);
  const [themeMode, setThemeModeState] = useState<string>(
    () => localStorage.getItem('theme') || 'dark',
  );

  const setCustomBackground = (bg: CustomBackground | null) => {
    setCustomBackgroundState(bg);
    if (bg) {
      localStorage.setItem('custom_bg', JSON.stringify(bg));
    } else {
      localStorage.removeItem('custom_bg');
    }
  };

  const applyColorVars = (hex: string) => {
    const vars = generateColorVars(hex);
    Object.entries(vars).forEach(([key, value]) => {
      document.documentElement.style.setProperty(key, value);
    });
  };

  const setAccentColor = (hex: string) => {
    if (/^#[0-9A-F]{3,8}$/i.test(hex)) {
      applyColorVars(hex);

      if ((window as any)._themeDebounce) clearTimeout((window as any)._themeDebounce);
      (window as any)._themeDebounce = setTimeout(() => {
        setAccentColorState(hex);
        localStorage.setItem('accent_color', hex);

        const activeMode = localStorage.getItem('theme');
        if (activeMode === 'custom') {
          const savedThemeJson = localStorage.getItem('active_custom_theme_json');
          if (savedThemeJson) {
            try {
              const parsed = JSON.parse(savedThemeJson);
              if (!parsed.colors) parsed.colors = {};
              parsed.colors.primary = hex;
              localStorage.setItem('active_custom_theme_json', JSON.stringify(parsed, null, 2));
            } catch (e) {}
          }
        }
      }, 50);
    }
  };

  // Parses a raw JSON theme object and applies all the custom colors and radii as CSS variables to the root.
  const loadThemeFromJson = (jsonString: string): boolean => {
    try {
      const config: ThemeConfig = JSON.parse(jsonString);
      if (!config.colors) return false;

      const v3Colors: Record<string, string | undefined> = {
        '--bg-base': config.colors.background || config.colors['bg-color'],
        '--background': config.colors.background || config.colors['bg-color'],
        '--text-primary': config.colors.foreground || config.colors['text-color'],
        '--foreground': config.colors.foreground || config.colors['text-color'],
        '--bg-surface': config.colors.content1 || config.colors['sidebar-bg'],
        '--content1': config.colors.content1 || config.colors['sidebar-bg'],
        '--bg-elevated': config.colors.content2 || config.colors['bg-secondary'],
        '--content2': config.colors.content2 || config.colors['bg-secondary'],
        '--border-subtle': config.colors.content3 || config.colors['input-bg'],
        '--content3': config.colors.content3 || config.colors['input-bg'],
      };

      if (config.colors.border) {
        v3Colors['--border-strong'] = config.colors.border;
        v3Colors['--content4'] = config.colors.border;
      }

      Object.entries(v3Colors).forEach(([key, hex]) => {
        if (hex && /^#[0-9A-F]{3,8}$/i.test(hex)) {
          document.documentElement.style.setProperty(key, hex);
        }
      });

      const semanticColors = ['primary', 'secondary', 'success', 'warning', 'danger', 'default'];
      semanticColors.forEach((colorName) => {
        const hex = config.colors![colorName];
        if (hex && /^#[0-9A-F]{3,8}$/i.test(hex)) {
          const vars = generateColorVars(hex, colorName);
          Object.entries(vars).forEach(([k, v]) => {
            document.documentElement.style.setProperty(k, v);
          });
          if (colorName === 'primary') {
            setAccentColorState(hex);
            localStorage.setItem('accent_color', hex);
          }
        }
      });

      if (config.style) {
        if (config.style.border_radius) {
          document.documentElement.style.setProperty('--radius-sm', config.style.border_radius);
          document.documentElement.style.setProperty('--radius-md', config.style.border_radius);
          document.documentElement.style.setProperty('--radius-lg', config.style.border_radius);
        }
        if (config.style.blur) {
          document.documentElement.style.setProperty('--glass-blur', config.style.blur);
        }
        if (config.style.shadow) {
          document.documentElement.style.setProperty('--shadow-elevated', config.style.shadow);
        }
        if (config.style.app_opacity) {
          document.documentElement.style.setProperty('--app-opacity', config.style.app_opacity);
        }
      }

      if (config.background) {
        const bgUrl = config.background.video || config.background.image;
        if (bgUrl) {
          const type = config.background.video ? 'video' : 'image';
          setCustomBackground({ type, path: bgUrl });
        } else {
          setCustomBackground(null);
        }
      } else {
        setCustomBackground(null);
      }

      if (config.logo) {
        setCustomLogoState(config.logo);
      } else {
        setCustomLogoState(null);
      }

      localStorage.setItem('active_custom_theme_json', jsonString);
      return true;
    } catch (err) {
      console.error('Failed to parse theme JSON:', err);
      return false;
    }
  };

  const clearCustomTheme = () => {
    localStorage.removeItem('active_custom_theme_json');
    const keys = [
      '--bg-base',
      '--background',
      '--text-primary',
      '--foreground',
      '--bg-surface',
      '--content1',
      '--bg-elevated',
      '--content2',
      '--border-subtle',
      '--content3',
      '--border-strong',
      '--content4',
      '--radius-sm',
      '--radius-md',
      '--radius-lg',
      '--glass-blur',
      '--shadow-elevated',
      '--app-opacity',
    ];
    keys.forEach((k) => document.documentElement.style.removeProperty(k));
    setCustomBackground(null);
    setCustomLogoState(null);
  };

  const setThemeMode = (mode: string) => {
    setThemeModeState(mode);
    localStorage.setItem('theme', mode);

    if (mode === 'custom') return;

    if (mode === 'light') {
      document.documentElement.classList.remove('dark');
      clearCustomTheme();
    } else {
      document.documentElement.classList.add('dark');
      clearCustomTheme();
    }
  };

  useEffect(() => {
    const savedThemeJson = localStorage.getItem('active_custom_theme_json');
    if (savedThemeJson) {
      loadThemeFromJson(savedThemeJson);
    } else {
      const savedColor = localStorage.getItem('accent_color');
      if (savedColor && /^#[0-9A-F]{3,8}$/i.test(savedColor)) {
        setAccentColorState(savedColor);
        applyColorVars(savedColor);
      } else {
        setAccentColorState('#10b981');
        applyColorVars('#10b981');
      }
    }

    const savedBg = localStorage.getItem('custom_bg');
    if (savedBg) {
      try {
        setCustomBackgroundState(JSON.parse(savedBg));
      } catch (e) {
        localStorage.removeItem('custom_bg');
      }
    }

    return () => {
      // Cleanup if needed
    };
  }, []);

  return (
    <ThemeContext.Provider
      value={{
        accentColor,
        setAccentColor,
        customBackground,
        setCustomBackground,
        customLogo: customLogoState,
        loadThemeFromJson,
        clearCustomTheme,
        themeMode,
        setThemeMode,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useThemeAccent = () => useContext(ThemeContext);

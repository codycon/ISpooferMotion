import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { defineConfig } from 'vite';

function loadOAuthEnv(): Record<string, string> {
  const configPath = resolve(__dirname, 'src-tauri', 'oauth.config.json');
  if (!existsSync(configPath)) {
    return {};
  }
  try {
    const raw = readFileSync(configPath, 'utf-8');
    const parsed = JSON.parse(raw) as { clientId?: string; redirectUri?: string };
    const env: Record<string, string> = {};
    if (parsed.clientId) env.VITE_OAUTH_CLIENT_ID = parsed.clientId;
    if (parsed.redirectUri) env.VITE_OAUTH_REDIRECT_URI = parsed.redirectUri;
    return env;
  } catch {
    return {};
  }
}

const devOAuthUIPath = resolve(__dirname, 'src', 'features', 'oauth', 'oauth-ui.dev.tsx');
const hasDevOAuthUI = existsSync(devOAuthUIPath);

export default defineConfig(({ command }) => {
  const isDev = command === 'serve';
  const injectOAuth = isDev && hasDevOAuthUI;

  return {
    base: './',
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        'virtual:oauth': injectOAuth
          ? devOAuthUIPath
          : resolve(__dirname, 'src', 'features', 'oauth', 'empty.tsx'),
      },
    },
    define: {
      'import.meta.env.VITE_OAUTH_CLIENT_ID': JSON.stringify(
        loadOAuthEnv().VITE_OAUTH_CLIENT_ID ?? '',
      ),
      'import.meta.env.VITE_OAUTH_REDIRECT_URI': JSON.stringify(
        loadOAuthEnv().VITE_OAUTH_REDIRECT_URI ?? '',
      ),
    },
    build: {
      rollupOptions: {
        input: {
          main: resolve(__dirname, 'index.html'),
          splash: resolve(__dirname, 'splash.html'),
          themeEditor: resolve(__dirname, 'theme-editor.html'),
        },
      },
    },
    server: {
      proxy: {
        '/api': {
          target: 'https://www.incredidev.com',
          changeOrigin: true,
          secure: false,
        },
      },
    },
  };
});

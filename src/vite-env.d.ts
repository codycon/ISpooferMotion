/// <reference types="vite/client" />

interface Window {
  tauriAPI: any;
}

declare module 'virtual:oauth' {
  import type { OAuthModule } from './features/oauth/types';
  export const OAuthSettingsGroup: OAuthModule['OAuthSettingsGroup'];
  export const useOAuthState: OAuthModule['useOAuthState'];
  export const oauthTutorialSteps: OAuthModule['oauthTutorialSteps'];
}

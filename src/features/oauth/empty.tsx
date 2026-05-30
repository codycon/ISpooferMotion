import type { OAuthModule } from './types';

export const OAuthSettingsGroup: OAuthModule['OAuthSettingsGroup'] = () => null;

export const useOAuthState: OAuthModule['useOAuthState'] = (config, manualCookieEdit) => {
  const autoDetectEnabled = config.advanced.autoCookieStudio || config.advanced.autoCookieBrowser;

  return {
    oauthEnabled: false,
    cookieReadOnly: autoDetectEnabled && !manualCookieEdit,
    oauthLoading: false,
    authStatus: 'idle',
    handleOAuthLogin: async () => {},
    setAuthStatus: () => {},
  };
};

export const oauthTutorialSteps: OAuthModule['oauthTutorialSteps'] = [];

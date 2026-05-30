export interface OAuthConfig {
  clientId: string;
  redirectUri: string;
}

export function loadDevOAuthConfig(): OAuthConfig {
  const clientId = (import.meta.env.VITE_OAUTH_CLIENT_ID as string | undefined) ?? '';
  const redirectUri =
    (import.meta.env.VITE_OAUTH_REDIRECT_URI as string | undefined) ??
    'http://localhost:43110/oauth/callback';

  return { clientId, redirectUri };
}

export function hasDevOAuthConfig(): boolean {
  return !!(import.meta.env.VITE_OAUTH_CLIENT_ID as string | undefined);
}

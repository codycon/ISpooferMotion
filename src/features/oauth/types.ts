import React from 'react';
import type { TutorialStep } from '../../ism-library';

export interface OAuthState {
  oauthEnabled: boolean;
  cookieReadOnly: boolean;
  oauthLoading: boolean;
  authStatus: 'idle' | 'loading' | 'success' | 'error';
  handleOAuthLogin: () => Promise<void>;
  setAuthStatus: (status: 'idle' | 'loading' | 'success' | 'error') => void;
}

export interface OAuthGroupProps {
  config: any;
  updateConfig: (category: string, key: string, value: any) => void;
  updateCategory: (category: string, values: any) => void;
  setActiveTutorial: (tutorial: 'openCloud' | 'oauth') => void;
  setIsModalOpen: (open: boolean) => void;
  oauthState: OAuthState;
  users: any[];
  selectedUser: string;
  onSelectUser: (userId: string) => void;
  onDeleteUser: (userId: string) => void;
  onOAuthSuccess: (profile: any) => void;
}

export interface OAuthModule {
  OAuthSettingsGroup: React.FC<OAuthGroupProps>;
  useOAuthState: (config: any, manualCookieEdit: boolean) => OAuthState;
  oauthTutorialSteps: TutorialStep[];
}

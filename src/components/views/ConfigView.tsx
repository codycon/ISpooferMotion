import { open as openUrl } from '@tauri-apps/plugin-shell';
import { AnimatePresence, motion } from 'framer-motion';
import { CircleHelp, Key, ShieldAlert, Sliders } from 'lucide-react';
import { useEffect, useState } from 'react';
import { OAuthSettingsGroup, oauthTutorialSteps, useOAuthState } from 'virtual:oauth';
import CreateApiKeyImg from '../../assets/tutorial/create_api_key.png';
import NameApiKeyImg from '../../assets/tutorial/name_api_key.png';
import Step4AccessImg from '../../assets/tutorial/step_4_access_permissions.png';
import Step5OperationsImg from '../../assets/tutorial/step_5_operations.png';
import Step6SaveKeyImg from '../../assets/tutorial/step_6_save_key.png';
import Step7CopyKeyImg from '../../assets/tutorial/step_7_copy_key.png';
import { useConfig } from '../../contexts/ConfigContext';
import { useLanguage } from '../../contexts/LanguageContext';
import {
  Accordion,
  AccordionItem,
  FormDropdown,
  FormInput,
  Group,
  HelpTooltip,
  itemVariants,
  pageVariants,
  Row,
  TutorialModal,
  TutorialStep,
  Window,
} from '../../ism-library';
import { hasDevOAuthConfig } from '../../utils/oauthConfig';
import {
  deleteSavedProfileCookie,
  detectCookie,
  loadCachedUsers,
  logIsm,
  mergeCachedUser,
  normalizeId,
  RobloxUserInfo,
  validateCookieProfile,
} from '../../utils/robloxProfiles';

type AuthStatus = 'idle' | 'loading' | 'success' | 'error';

function HelpButton({
  label,
  tooltip,
  onClick,
  className = '',
}: {
  label: string;
  tooltip?: React.ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={(e) => {
        e.preventDefault();
        onClick?.();
      }}
      className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-border-subtle bg-bg-surface/80 text-text-muted shadow-sm transition-colors hover:border-primary/50 hover:bg-bg-elevated hover:text-primary focus:outline-none focus:ring-2 focus:ring-primary/50 cursor-default ${className}`}
    >
      <CircleHelp size={14} />
    </button>
  );
}

export default function ConfigView() {
  const { t } = useLanguage();
  const { config, updateConfig, updateCategory } = useConfig();
  const DEV_OAUTH = hasDevOAuthConfig();

  const [users, setUsers] = useState<RobloxUserInfo[]>(loadCachedUsers);
  const [manualCookieEdit, setManualCookieEdit] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTutorial, setActiveTutorial] = useState<'openCloud' | 'oauth'>('openCloud');

  const oauthState = useOAuthState(config, manualCookieEdit);
  const { oauthEnabled, cookieReadOnly, authStatus, setAuthStatus } = oauthState;

  const handleOAuthSuccess = (profile: any) => {
    const nextProfile = { ...profile, authType: 'oauth' as const };
    const nextUsers = mergeCachedUser(nextProfile);
    setUsers(nextUsers);
    updateCategory('spoofing', {
      selectedUser: String(nextProfile.id),
      selectedGroup: 'none',
      cookie: '',
    });
  };

  const openCloudSteps: TutorialStep[] = [
    {
      title: 'Step 1: Creator Dashboard',
      hideHeader: true,
      description: 'Press this Key icon to open the Roblox Creator Dashboard in your browser.',
      target: '#open-cloud-key-btn',
    },
    {
      title: 'Step 2: Create API Key',
      hideHeader: true,
      description: 'Click the "Create API Key" button.',
      image: CreateApiKeyImg,
    },
    {
      title: 'Step 3: Name your API Key',
      hideHeader: true,
      description:
        'Give the API key a name (required by Roblox, you can name it anything you want like "ISpooferMotion"). You can also optionally provide a description.',
      image: NameApiKeyImg,
    },
    {
      title: 'Step 4: Access Permissions',
      hideHeader: true,
      description:
        'Go to Access Permissions, click the "Select API System" dropdown, and select "assets".',
      image: Step4AccessImg,
    },
    {
      title: 'Step 5: Select Operations',
      hideHeader: true,
      description:
        'A new dropdown will appear. Click "Select Operations to Add" and select BOTH "read" and "write" operations.',
      image: Step5OperationsImg,
    },
    {
      title: 'Step 6: Save & Generate Key',
      hideHeader: true,
      description:
        'Scroll to the bottom, click "Save & Generate Key", and make sure to check "I understand the security risks".',
      image: Step6SaveKeyImg,
    },
    {
      title: 'Step 7: Copy and Paste',
      hideHeader: true,
      description:
        'Click "Copy Key To Clipboard" and paste it right here in the app! You are now ready to start spoofing.',
      image: Step7CopyKeyImg,
      target: '#open-cloud-api-input',
      hideHeader: true,
      hideImage: true,
    },
  ];
  const getCookieDetectionMode = () => {
    if (config.advanced.autoCookieStudio) return 'studio';
    if (config.advanced.autoCookieBrowser) return 'browser';
    return 'none';
  };

  const applyValidatedCookie = (result: Awaited<ReturnType<typeof validateCookieProfile>>) => {
    const nextUsers = mergeCachedUser(result.user);
    setUsers(nextUsers);
    updateCategory('spoofing', {
      cookie: result.cookie,
      selectedUser: String(result.user.id),
      selectedGroup: 'none',
    });
    setAuthStatus('success');
    logIsm('info', `Cookie validated for ${result.user.displayName || result.user.name}.`);
  };

  const runAutoDetect = async (mode: string) => {
    if (mode === 'none' || oauthEnabled) return;
    setAuthStatus('loading');
    logIsm('info', `Auto detecting Roblox cookie from ${mode}.`);
    try {
      const detected = await detectCookie(
        mode as 'studio' | 'browser',
        config.spoofing.selectedUser === 'none' ? null : config.spoofing.selectedUser,
      );
      if (!detected) {
        setAuthStatus('idle');
        logIsm('info', 'No Roblox cookie was found.');
        return;
      }
      const result = await validateCookieProfile(detected);
      applyValidatedCookie(result);
    } catch {
      setAuthStatus('idle');
      logIsm('warn', 'Auto-detected cookie was invalid or expired.');
    }
  };

  const handleCookieDetectionChange = (val: string) => {
    updateCategory('advanced', {
      autoCookieStudio: val === 'studio',
      autoCookieBrowser: val === 'browser',
    });
    setManualCookieEdit(false);
    if (val !== 'none') {
      runAutoDetect(val);
    }
  };

  useEffect(() => {
    const cookie = config.spoofing.cookie.trim();
    if (cookieReadOnly) return;
    if (!cookie || cookie.length < 50) return;
    const timer = window.setTimeout(async () => {
      try {
        const result = await validateCookieProfile(cookie);
        applyValidatedCookie(result);
      } catch {
        setAuthStatus('idle');
        logIsm('warn', 'The manually entered Roblox cookie could not be validated.');
      }
    }, 900);
    return () => window.clearTimeout(timer);
  }, [config.spoofing.cookie, cookieReadOnly]);

  const handleSelectSavedUser = async (userId: string) => {
    updateCategory('spoofing', {
      selectedUser: userId,
      selectedGroup: 'none',
      cookie: '',
    });
    setAuthStatus('idle');
    logIsm(
      'info',
      userId === 'none' ? 'Saved profile selection cleared.' : `Saved profile selected: ${userId}.`,
    );
  };

  const handleDeleteSavedUser = async (userId: string) => {
    await deleteSavedProfileCookie(userId);
    const nextUsers = users.filter((user) => normalizeId(user.id) !== normalizeId(userId));
    setUsers(nextUsers);
    localStorage.setItem('ISpooferMotion_DetectedUsers', JSON.stringify(nextUsers));
    if (normalizeId(config.spoofing.selectedUser) === normalizeId(userId)) {
      updateCategory('spoofing', {
        selectedUser: 'none',
        selectedGroup: 'none',
        cookie: '',
      });
    }
    setAuthStatus('success');
    logIsm('info', 'Saved profile removed.');
  };

  return (
    <motion.div
      variants={pageVariants}
      initial="hidden"
      animate="show"
      exit="exit"
      className="w-full h-full tour-config-page"
    >
      <Window>
        <motion.div variants={itemVariants} className="w-full flex flex-col gap-8">
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-bold text-text-primary tracking-tight">
              {t('config.title')}
            </h1>
            <p className="text-sm text-text-muted font-medium">{t('config.subtitle')}</p>
          </div>

          <Accordion
            selectionMode="multiple"
            expandedKeys={config.ui.configSections}
            onExpandedChange={(keys) => updateConfig('ui', 'configSections', keys)}
            className="flex flex-col gap-6"
          >
            <AccordionItem
              value="credentials"
              title={
                <span className="flex items-center gap-3 font-semibold">
                  <Key size={18} className="text-primary" /> Credentials
                </span>
              }
              className="tour-config-credentials"
            >
              <Group>
                <motion.div
                  initial={false}
                  animate={{ opacity: oauthEnabled ? 0.5 : 1 }}
                  transition={{ duration: 0.3 }}
                  className={oauthEnabled ? 'pointer-events-none' : ''}
                >
                  <FormDropdown
                    label={
                      <span className="inline-flex items-center gap-1.5">
                        Auto Detect Cookie
                        <HelpTooltip content="Checks Roblox Studio first, then supported browser profiles. If it is on, double-click the cookie field to switch back to manual editing." />
                      </span>
                    }
                    options={[
                      { value: 'none', label: 'Disabled' },
                      { value: 'studio', label: 'Roblox Studio' },
                      { value: 'browser', label: 'Web Browser' },
                    ]}
                    value={getCookieDetectionMode()}
                    onChange={handleCookieDetectionChange}
                    width="w-[200px]"
                    disabled={oauthEnabled}
                  />
                </motion.div>
                <motion.div
                  initial={false}
                  animate={{ opacity: oauthEnabled ? 0.5 : 1 }}
                  transition={{ duration: 0.3 }}
                  className={oauthEnabled ? 'pointer-events-none w-full' : 'w-full'}
                  onDoubleClick={() => {
                    if (autoDetectEnabled && !oauthEnabled) {
                      updateCategory('advanced', {
                        autoCookieStudio: false,
                        autoCookieBrowser: false,
                      });
                      setManualCookieEdit(true);
                      logIsm('info', 'Auto Detect Cookie disabled for manual cookie editing.');
                    }
                  }}
                >
                  <FormInput
                    label="Roblox Cookie"
                    placeholder={
                      <AnimatePresence mode="wait">
                        <motion.span
                          key={oauthEnabled ? 'oauth' : cookieReadOnly ? 'readonly' : 'manual'}
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 4 }}
                          transition={{ duration: 0.15 }}
                          className="block"
                        >
                          {cookieReadOnly
                            ? oauthEnabled
                              ? 'Cookie auth is disabled while V2 OAuth is enabled.'
                              : 'Auto Detect Cookie enabled. Double-click to edit manually.'
                            : 'Paste .ROBLOSECURITY manually'}
                        </motion.span>
                      </AnimatePresence>
                    }
                    type="password"
                    disabled={oauthEnabled}
                    readOnly={cookieReadOnly}
                    value={cookieReadOnly ? '' : config.spoofing.cookie}
                    onChange={(value: string) => updateConfig('spoofing', 'cookie', value)}
                    className={cookieReadOnly && !oauthEnabled ? 'opacity-60' : ''}
                  />
                </motion.div>
                <motion.div
                  id="open-cloud-api-input"
                  initial={false}
                  animate={{
                    opacity: oauthEnabled ? 0.5 : 1,
                  }}
                  transition={{ duration: 0.3 }}
                  className={oauthEnabled ? 'pointer-events-none' : ''}
                >
                  <FormInput
                    label={
                      <span className="inline-flex items-center gap-2">
                        Open Cloud API Key
                        <HelpButton
                          label="Open Cloud API Key help"
                          tooltip="Opens a focused tutorial for creating and pasting an Open Cloud API key."
                          className="tour-config-api-help"
                          onClick={() => {
                            setActiveTutorial('openCloud');
                            setIsModalOpen(true);
                          }}
                        />
                      </span>
                    }
                    placeholder={
                      <AnimatePresence mode="wait">
                        <motion.span
                          key={oauthEnabled ? 'oauth' : 'default'}
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 4 }}
                          transition={{ duration: 0.15 }}
                          className="block"
                        >
                          {oauthEnabled
                            ? 'Open Cloud API Key is disabled while V2 OAuth is enabled.'
                            : 'Press the key icon to get your API key, then paste it here'}
                        </motion.span>
                      </AnimatePresence>
                    }
                    type="password"
                    disabled={oauthEnabled}
                    endContent={
                      <button
                        id="open-cloud-key-btn"
                        type="button"
                        onClick={() => openUrl('https://create.roblox.com/dashboard/credentials')}
                        className="p-1 rounded hover:bg-bg-elevated text-text-muted hover:text-primary transition-colors cursor-pointer"
                        aria-label="Open Cloud API Credentials"
                        disabled={oauthEnabled}
                      >
                        <Key size={16} />
                      </button>
                    }
                    value={config.spoofing.apiKey}
                    onChange={(value: string) => updateConfig('spoofing', 'apiKey', value)}
                  />
                </motion.div>
              </Group>

              <OAuthSettingsGroup
                config={config}
                updateConfig={updateConfig}
                updateCategory={updateCategory}
                setActiveTutorial={setActiveTutorial}
                setIsModalOpen={setIsModalOpen}
                oauthState={oauthState}
                users={users}
                selectedUser={config.spoofing.selectedUser}
                onSelectUser={handleSelectSavedUser}
                onDeleteUser={handleDeleteSavedUser}
                onOAuthSuccess={handleOAuthSuccess}
              />
            </AccordionItem>

            <AccordionItem
              value="routing"
              title={
                <span className="flex items-center gap-3 font-semibold">
                  <Sliders size={18} className="text-primary" /> Routing and Limits
                </span>
              }
              className="tour-config-routing"
            >
              <Group>
                <Row>
                  <FormInput
                    label={t('settings.pluginPort')}
                    type="number"
                    value={config.advanced.pluginPort}
                    onChange={(value: string) => updateConfig('advanced', 'pluginPort', value)}
                  />
                  <FormInput
                    label={t('settings.forcePlaceIds')}
                    placeholder={t('settings.forcePlaceIdsPlaceholder')}
                    value={config.advanced.forcePlaceIds}
                    onChange={(value: string) => updateConfig('advanced', 'forcePlaceIds', value)}
                  />
                </Row>
                <Row>
                  <FormInput
                    label={t('settings.searchLimit')}
                    type="number"
                    value={config.advanced.placeIdSearchLimit}
                    onChange={(value: string) =>
                      updateConfig('advanced', 'placeIdSearchLimit', value)
                    }
                  />
                  <FormInput
                    label={t('settings.assetScanTimeout')}
                    type="number"
                    value={config.advanced.assetScanTimeout}
                    onChange={(value: string) =>
                      updateConfig('advanced', 'assetScanTimeout', value)
                    }
                  />
                </Row>
              </Group>
            </AccordionItem>

            <AccordionItem
              value="exclusions"
              title={
                <span className="flex items-center gap-3 font-semibold">
                  <ShieldAlert size={18} className="text-primary" /> Exclusions
                </span>
              }
              className="tour-config-exclusions"
            >
              <Group>
                <Row>
                  <FormInput
                    label={t('settings.excludedUsers')}
                    placeholder={t('settings.excludedUsersPlaceholder')}
                    value={config.advanced.excludedUserIds}
                    onChange={(value: string) => updateConfig('advanced', 'excludedUserIds', value)}
                  />
                  <FormInput
                    label={t('settings.excludedGroups')}
                    placeholder={t('settings.excludedGroupsPlaceholder')}
                    value={config.advanced.excludedGroupIds}
                    onChange={(value: string) =>
                      updateConfig('advanced', 'excludedGroupIds', value)
                    }
                  />
                </Row>
              </Group>
            </AccordionItem>
          </Accordion>
        </motion.div>
      </Window>

      <TutorialModal
        isOpen={isModalOpen}
        onOpenChange={setIsModalOpen}
        title={
          activeTutorial === 'openCloud'
            ? 'Open Cloud API Key Tutorial'
            : 'OAuth 2.0 Setup Tutorial'
        }
        steps={activeTutorial === 'openCloud' ? openCloudSteps : oauthTutorialSteps}
      />
    </motion.div>
  );
}

import { AnimatePresence, motion } from 'framer-motion';
import { Info, SlidersHorizontal } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useConfig } from '../../contexts/ConfigContext';
import { FormInput, FormToggle, IconButton } from '../../ism-library';
import { logIsm } from '../../utils/robloxProfiles';

export const AVAILABLE_QUICK_SETTINGS = [
  // Config > Credentials
  {
    id: 'spoofing.cookie',
    label: 'Roblox Cookie',
    type: 'password',
    page: 'Config',
    section: 'Credentials',
  },
  {
    id: 'spoofing.apiKey',
    label: 'OpenCloud API Key',
    type: 'password',
    page: 'Config',
    section: 'Credentials',
  },
  {
    id: 'advanced.autoCookieStudio',
    label: 'Auto-Cookie (Studio)',
    type: 'toggle',
    page: 'Config',
    section: 'Credentials',
  },
  {
    id: 'advanced.autoCookieBrowser',
    label: 'Auto-Cookie (Browser)',
    type: 'toggle',
    page: 'Config',
    section: 'Credentials',
  },

  // Config > Routing and Limits
  {
    id: 'advanced.pluginPort',
    label: 'Plugin Port',
    type: 'text',
    page: 'Config',
    section: 'Routing and Limits',
  },
  {
    id: 'advanced.forcePlaceIds',
    label: 'Force Place IDs',
    type: 'text',
    page: 'Config',
    section: 'Routing and Limits',
  },
  {
    id: 'advanced.placeIdSearchLimit',
    label: 'Place ID Search Limit',
    type: 'number',
    page: 'Config',
    section: 'Routing and Limits',
  },
  {
    id: 'advanced.assetScanTimeout',
    label: 'Asset Scan Timeout (s)',
    type: 'number',
    page: 'Config',
    section: 'Routing and Limits',
  },

  // Config > Exclusions
  {
    id: 'advanced.excludedUserIds',
    label: 'Excluded User IDs',
    type: 'text',
    page: 'Config',
    section: 'Exclusions',
  },
  {
    id: 'advanced.excludedGroupIds',
    label: 'Excluded Group IDs',
    type: 'text',
    page: 'Config',
    section: 'Exclusions',
  },

  // Settings > General
  {
    id: 'general.desktopNotifications',
    label: 'Desktop Notifications',
    type: 'toggle',
    page: 'Settings',
    section: 'General',
  },

];

export default function QuickSettingsMenu() {
  const { config, updateConfig } = useConfig();
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });

  const openMenu = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const menuWidth = 320;
      setCoords({
        top: rect.bottom + 8,
        left: rect.right - menuWidth,
        width: menuWidth,
      });
      setOpen(true);
    }
  };

  useEffect(() => {
    const handleResize = () => setOpen(false);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const activeSettings = config.ui.quickSettings
    .map((id) => AVAILABLE_QUICK_SETTINGS.find((s) => s.id === id))
    .filter(Boolean) as typeof AVAILABLE_QUICK_SETTINGS;

  const groupedSettings = activeSettings.reduce(
    (acc, setting) => {
      const groupKey = `${setting.page} > ${setting.section}`;
      if (!acc[groupKey]) acc[groupKey] = [];
      acc[groupKey].push(setting);
      return acc;
    },
    {} as Record<string, typeof AVAILABLE_QUICK_SETTINGS>,
  );

  return (
    <>
      <div ref={buttonRef} className="inline-flex tour-quick-settings-button">
        <IconButton
          label="Quick Settings"
          onClick={openMenu}
          className={open ? 'text-primary' : 'text-text-muted'}
        >
          <SlidersHorizontal size={16} />
        </IconButton>
      </div>
      {createPortal(
        <AnimatePresence>
          {open && (
            <>
              <div className="fixed inset-0 z-[490]" onPointerDown={() => setOpen(false)} />
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.98 }}
                transition={{ duration: 0.16, ease: 'easeOut' }}
                onPointerDown={(e) => e.stopPropagation()}
                className="fixed z-[500] rounded-[var(--radius-md)] border border-border-subtle bg-bg-surface shadow-floating overflow-hidden flex flex-col"
                style={{ top: coords.top, left: coords.left, width: coords.width }}
              >
                <div className="px-4 py-3 border-b border-border-subtle bg-bg-elevated/30 flex justify-between items-center">
                  <h3 className="text-[12px] font-bold text-text-primary uppercase tracking-wider">
                    Quick Settings
                  </h3>
                </div>

                <div className="max-h-[60vh] overflow-y-auto py-2 custom-scrollbar flex flex-col gap-1" data-lenis-prevent="true">
                  {Object.keys(groupedSettings).length === 0 ? (
                    <div className="px-4 py-6 text-center text-text-muted flex flex-col items-center gap-2">
                      <Info size={24} className="opacity-50" />
                      <div className="text-sm font-medium">No Quick Settings</div>
                      <div className="text-[12px]">Add items from the Settings page.</div>
                    </div>
                  ) : (
                    Object.entries(groupedSettings).map(([groupKey, settings]) => (
                      <div
                        key={groupKey}
                        className="flex flex-col mb-1 pb-2 border-b border-border-subtle last:border-b-0 last:pb-0"
                      >
                        <div className="px-4 py-2 text-[10px] font-bold text-text-muted uppercase tracking-wider">
                          {groupKey}
                        </div>
                        {settings.map((setting) => {
                          const [cat, key] = setting.id.split('.');
                          const value = (config as any)[cat][key];
                          return (
                            <div key={setting.id} className="flex flex-col px-4 py-1.5">
                              {setting.type === 'toggle' ? (
                                <FormToggle
                                  label={setting.label}
                                  checked={value as boolean}
                                  onChange={(val) => {
                                    updateConfig(cat as any, key as any, val);
                                  }}
                                />
                              ) : (
                                <FormInput
                                  label={setting.label}
                                  type={setting.type as any}
                                  value={value as string}
                                  onChange={(val) => updateConfig(cat as any, key as any, val)}
                                />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ))
                  )}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  );
}

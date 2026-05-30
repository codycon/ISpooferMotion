import { useEffect, useState } from 'react';
import { useConfig } from '../../contexts/ConfigContext';
import {
  Button,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  TutorialModal,
  TutorialStep,
} from '../../ism-library';

export default function OnboardingManager() {
  const { config, updateConfig } = useConfig();

  const [showWelcomePrompt, setShowWelcomePrompt] = useState(
    import.meta.env.DEV || !config.general.hasSeenFirstTimeTutorial,
  );
  const [showTutorial, setShowTutorial] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [skipBackSteps, setSkipBackSteps] = useState<Record<number, number>>({});

  const dismissWelcome = () => {
    setShowWelcomePrompt(false);
    updateConfig('general', 'hasSeenFirstTimeTutorial', true);
  };

  const startTutorial = () => {
    setShowWelcomePrompt(false);
    setShowTutorial(true);
    setCurrentStep(0);
    setSkipBackSteps({});
    updateConfig('ui', 'activeTab', 'home');
    updateConfig('general', 'hasSeenFirstTimeTutorial', true);
  };

  useEffect(() => {
    document.addEventListener('restart-tutorial', startTutorial);
    return () => document.removeEventListener('restart-tutorial', startTutorial);
  }, [config]);

  const goToStep = (stepIndex: number, tab?: string) => {
    setCurrentStep(stepIndex);
    if (tab) {
      updateConfig('ui', 'activeTab', tab);
    }
  };

  const skipToStep = (fromStep: number, stepIndex: number, tab?: string) => {
    setSkipBackSteps((prev) => ({ ...prev, [stepIndex]: fromStep }));
    goToStep(stepIndex, tab);
  };

  const previousStep = (current: number, fallback: number, tab?: string) => {
    goToStep(skipBackSteps[current] ?? fallback, tab);
  };

  const tutorialSteps: TutorialStep[] = [
    // 0
    {
      title: 'Need Help?',
      description:
        "If you ever get stuck or this tutorial doesn't help at all, look here for more help. We have a Discord, Wiki, and Video Tutorials!",
      target: '.tour-need-help',
      hideHeader: true,
      hideImage: true,
      hideDots: true,
      secondaryButtonText: null,
      onPrimaryClick: () => goToStep(1),
    },
    // 1
    {
      title: 'The Spoofer',
      hideHeader: true,
      description:
        'This is the main Spoofer tool where you configure what assets you want to Spoof.',
      target: '.tour-sidebar-spoofing',
      hideImage: true,
      hideDots: true,
      primaryButtonText: 'Next',
      secondaryButtonText: 'Previous',
      skipButtonText: 'Skip Spoofer',
      onPrimaryClick: () => goToStep(2, 'spoofing'),
      onSecondaryClick: () => goToStep(0),
      onSkipClick: () => skipToStep(1, 5),
    },
    // 2
    {
      title: 'Spoofer Overview',
      hideHeader: true,
      description: 'Here you can set up everything related to your spoofing session.',
      hideImage: true,
      hideDots: true,
      primaryButtonText: 'Next',
      secondaryButtonText: 'Previous',
      onPrimaryClick: () => goToStep(3),
      onSecondaryClick: () => goToStep(1),
    },
    // 3
    {
      title: 'Targets',
      hideHeader: true,
      description:
        'Use the Targets section to define exactly which users, groups, and asset types you want to clone.',
      target: '.tour-spoofer-targets',
      hideImage: true,
      hideDots: true,
      primaryButtonText: 'Next',
      secondaryButtonText: 'Previous',
      onPrimaryClick: () => goToStep(4),
      onSecondaryClick: () => goToStep(2),
    },
    // 4
    {
      title: 'Execution',
      hideHeader: true,
      description:
        'Execution is where you review output, set run options, choose download behavior, and start or retry spoofing.',
      target: '.tour-spoofer-execution',
      placement: 'top-screen',
      hideImage: true,
      hideDots: true,
      primaryButtonText: 'Next',
      secondaryButtonText: 'Previous',
      onPrimaryClick: () => goToStep(5),
      onSecondaryClick: () => goToStep(3),
      onEnter: () => updateConfig('ui', 'spoofingSections', ['targets', 'execution']),
    },
    // 5
    {
      title: 'Asset Explorer',
      hideHeader: true,
      description:
        'The Asset Explorer allows you to view assets from Studio or RBXL/RBXLX files. Click this tab on the right side of the screen to open the Explorer panel.',
      target: '.tour-explorer-toggle',
      hideImage: true,
      hideDots: true,
      primaryButtonText: 'Next',
      secondaryButtonText: 'Previous',
      onPrimaryClick: () => {
        updateConfig('ui', 'assetExplorerOpen', true);
        setTimeout(() => goToStep(6), 300);
      },
      onSecondaryClick: () => goToStep(4),
    },
    // 6
    {
      title: 'Place Scanning',
      hideHeader: true,
      description:
        'You can drop a .rbxl or .rbxlx file into the dropzone to instantly scan and extract all the assets from the place file without needing to be in Studio.',
      target: '.tour-asset-explorer-dropzone',
      hideImage: true,
      hideDots: true,
      primaryButtonText: 'Next',
      secondaryButtonText: 'Previous',
      onPrimaryClick: () => {
        updateConfig('ui', 'assetExplorerOpen', false);
        setTimeout(() => goToStep(7), 300);
      },
      onSecondaryClick: () => goToStep(5),
    },
    // 7
    {
      title: 'Configuration',
      hideHeader: true,
      description: 'The Config tab is where you set up your Roblox API keys and Cookies.',
      target: '.tour-sidebar-config',
      hideImage: true,
      hideDots: true,
      primaryButtonText: 'Next',
      secondaryButtonText: 'Previous',
      skipButtonText: 'Skip Config',
      onPrimaryClick: () => goToStep(8, 'config'),
      onSecondaryClick: () => previousStep(7, 6),
      onSkipClick: () => skipToStep(7, 13),
    },
    // 8
    {
      title: 'Config Overview',
      hideHeader: true,
      description:
        'Ensure you have valid credentials entered here, otherwise the Spoofer will not be able to upload assets to your account.',
      hideImage: true,
      hideDots: true,
      primaryButtonText: 'Next',
      secondaryButtonText: 'Previous',
      onPrimaryClick: () => goToStep(9),
      onSecondaryClick: () => previousStep(8, 7),
      onEnter: () => updateConfig('ui', 'configSections', ['credentials', 'routing', 'exclusions']),
    },
    // 9
    {
      title: 'Credentials',
      hideHeader: true,
      description: 'Credentials is where cookie detection, manual cookies, and API keys live.',
      target: '.tour-config-credentials',
      hideImage: true,
      hideDots: true,
      primaryButtonText: 'Next',
      secondaryButtonText: 'Previous',
      onPrimaryClick: () => goToStep(10),
      onSecondaryClick: () => goToStep(8),
      onEnter: () => updateConfig('ui', 'configSections', ['credentials', 'routing', 'exclusions']),
    },
    // 10
    {
      title: 'Help Buttons',
      hideHeader: true,
      description:
        "Look out for these buttons when you're stuck. They open more information or a focused tutorial for that specific setting.",
      target: '.tour-config-api-help',
      hideImage: true,
      hideDots: true,
      primaryButtonText: 'Next',
      secondaryButtonText: 'Previous',
      onPrimaryClick: () => goToStep(11),
      onSecondaryClick: () => goToStep(9),
      onEnter: () => updateConfig('ui', 'configSections', ['credentials', 'routing', 'exclusions']),
    },
    // 11
    {
      title: 'Routing and Limits',
      hideHeader: true,
      description:
        'Routing and Limits controls plugin connection details, forced place IDs, search limits, and scan timeout values.',
      target: '.tour-config-routing',
      hideImage: true,
      hideDots: true,
      primaryButtonText: 'Next',
      secondaryButtonText: 'Previous',
      onPrimaryClick: () => goToStep(12),
      onSecondaryClick: () => goToStep(10),
      onEnter: () => updateConfig('ui', 'configSections', ['credentials', 'routing', 'exclusions']),
    },
    // 12
    {
      title: 'Exclusions',
      hideHeader: true,
      description:
        'Exclusions lets you list users or groups that should be ignored during scans and spoofing work.',
      target: '.tour-config-exclusions',
      hideImage: true,
      hideDots: true,
      primaryButtonText: 'Next',
      secondaryButtonText: 'Previous',
      onPrimaryClick: () => goToStep(13),
      onSecondaryClick: () => goToStep(11),
      onEnter: () => updateConfig('ui', 'configSections', ['credentials', 'routing', 'exclusions']),
    },
    // 13
    {
      title: 'Settings',
      hideHeader: true,
      description:
        'Settings is where you can tune app preferences, theme controls, notifications, and debug display options.',
      target: '.tour-sidebar-settings',
      hideImage: true,
      hideDots: true,
      primaryButtonText: 'Next',
      secondaryButtonText: 'Previous',
      skipButtonText: 'Skip Settings',
      onPrimaryClick: () => goToStep(14, 'settings'),
      onSecondaryClick: () => previousStep(13, 12),
      onSkipClick: () => skipToStep(13, 18),
    },
    // 14
    {
      title: 'Settings Overview',
      hideHeader: true,
      description:
        'Use this page to customize the app and open the theme editor when you want a more personal setup.',
      hideImage: true,
      hideDots: true,
      primaryButtonText: 'Next',
      secondaryButtonText: 'Previous',
      onPrimaryClick: () => goToStep(15),
      onSecondaryClick: () => goToStep(13),
      onEnter: () => updateConfig('ui', 'settingsSections', ['general', 'debug']),
    },
    // 15
    {
      title: 'General Settings',
      hideHeader: true,
      description:
        'General Settings covers updates, accordion behavior, notifications, language, themes, and accent color.',
      target: '.tour-settings-general',
      placement: 'bottom-screen',
      hideImage: true,
      hideDots: true,
      primaryButtonText: 'Next',
      secondaryButtonText: 'Previous',
      onPrimaryClick: () => goToStep(16),
      onSecondaryClick: () => goToStep(14),
      onEnter: () => updateConfig('ui', 'settingsSections', ['general', 'quickSettings', 'debug']),
    },
    // 16
    {
      title: 'Quick Settings Customization',
      hideHeader: true,
      description:
        'Select which options you want to appear in the Quick Settings menu for easy access from anywhere in the app.',
      target: '.tour-settings-quick-settings',
      hideImage: true,
      hideDots: true,
      primaryButtonText: 'Next',
      secondaryButtonText: 'Previous',
      onPrimaryClick: () => goToStep(17),
      onSecondaryClick: () => goToStep(15),
      onEnter: () => updateConfig('ui', 'settingsSections', ['general', 'quickSettings', 'debug']),
    },
    // 17
    {
      title: 'Quick Settings Menu',
      hideHeader: true,
      description:
        'Click this icon in the titlebar to instantly access all the Quick Settings you just selected!',
      target: '.tour-quick-settings-button',
      hideImage: true,
      hideDots: true,
      primaryButtonText: 'Next',
      secondaryButtonText: 'Previous',
      onPrimaryClick: () => goToStep(18),
      onSecondaryClick: () => goToStep(16),
    },
    // 18
    {
      title: 'Debug and Display',
      hideHeader: true,
      description:
        'Debug and Display contains troubleshooting tools like debug mode, cache controls, sound playback, and cache clearing.',
      target: '.tour-settings-debug',
      hideImage: true,
      hideDots: true,
      primaryButtonText: 'Next',
      secondaryButtonText: 'Previous',
      onPrimaryClick: () => goToStep(19),
      onSecondaryClick: () => goToStep(17),
      onEnter: () => updateConfig('ui', 'settingsSections', ['general', 'quickSettings', 'debug']),
    },
    // 19
    {
      title: 'Report Bugs',
      hideHeader: true,
      description:
        'If something breaks or feels off, this page gives you a direct place to send a bug report.',
      target: '.tour-sidebar-report_bug',
      hideImage: true,
      hideDots: true,
      primaryButtonText: 'Next',
      secondaryButtonText: 'Previous',
      onPrimaryClick: () => goToStep(20, 'home'),
      onSecondaryClick: () => previousStep(19, 18, 'settings'),
    },
    // 20
    {
      title: 'Support Me',
      hideHeader: true,
      description:
        'If you enjoy this software and want to support its continued development, please consider donating!',
      target: '.tour-support-button',
      hideImage: true,
      hideDots: true,
      primaryButtonText: 'Next',
      secondaryButtonText: 'Previous',
      onPrimaryClick: () => goToStep(21, 'home'),
      onSecondaryClick: () => previousStep(20, 19, 'home'),
    },
    // 21
    {
      title: "You're All Done",
      description: (
        <div className="flex flex-col gap-2">
          <p>You're all done. Happy spoofing!</p>
          <p>
            You can restart this tutorial from the Home page any time, and the small help buttons in
            Config will walk you through the trickier setup pieces.
          </p>
          <p>
            If something feels off later, check Config first, then Settings, and use Report Bugs if
            you need to send details over.
          </p>
        </div>
      ),
      hideImage: true,
      hideDots: true,
      primaryButtonText: 'Finish',
      secondaryButtonText: 'Previous',
      onPrimaryClick: () => setShowTutorial(false),
      onSecondaryClick: () => goToStep(18, 'home'),
      onEnter: () => updateConfig('ui', 'activeTab', 'home'),
    },
  ];

  return (
    <>
      <Modal isOpen={showWelcomePrompt} onOpenChange={dismissWelcome} size="sm">
        <ModalContent>
          <ModalHeader>Welcome to ISpooferMotion!</ModalHeader>
          <ModalBody>
            Would you like to go through a quick tutorial before getting started?
          </ModalBody>
          <ModalFooter className="flex justify-end gap-2">
            <Button variant="ghost" onClick={dismissWelcome}>
              No thanks
            </Button>
            <Button variant="solid" color="primary" onClick={startTutorial}>
              Start Tutorial
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <TutorialModal
        isOpen={showTutorial}
        onOpenChange={setShowTutorial}
        title="Getting Started"
        steps={tutorialSteps}
        currentStep={currentStep}
        onStepChange={setCurrentStep}
      />
    </>
  );
}

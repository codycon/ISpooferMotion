import { open as openDialog } from '@tauri-apps/plugin-dialog';
import confetti from 'canvas-confetti';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Paperclip, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import appIcon from '../../assets/app_icon.png';
import { useThemeAccent } from '../../contexts/ThemeContext';
import {
  Button,
  FormDropdown,
  FormInput,
  FormTextarea,
  getAutoContrastColor,
  itemVariants,
  pageVariants,
  Window,
} from '../../ism-library';

const consentItems = [
  'I can be contacted about this report if more detail is needed.',
  'I will not include passwords, cookies, tokens, or private account data.',
  'I have checked that this is an issue with the app or plugin.',
];

export default function ReportBugView() {
  const { accentColor } = useThemeAccent();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [termsAgreed, setTermsAgreed] = useState([false, false, false]);

  const allAgreed = termsAgreed.every(Boolean);
  const accentContrastColor = getAutoContrastColor(accentColor);

  const toggleTerm = (index: number) => {
    setTermsAgreed((prev) => {
      const next = [...prev];
      next[index] = !next[index];
      return next;
    });
  };

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('ui');
  const [description, setDescription] = useState('');
  const [steps, setSteps] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [attachments, setAttachments] = useState<string[]>([]);

  const [isSuccess, setIsSuccess] = useState(false);
  const [cooldownEnd, setCooldownEnd] = useState<number | null>(null);
  const [cooldownRemaining, setCooldownRemaining] = useState<number>(0);

  useEffect(() => {
    if (import.meta.env.DEV) {
      localStorage.removeItem('bugReportCooldown');
      return;
    }
    const saved = localStorage.getItem('bugReportCooldown');
    if (saved) {
      const end = parseInt(saved, 10);
      if (end > Date.now()) {
        setCooldownEnd(end);
        setCooldownRemaining(end - Date.now());
      } else {
        localStorage.removeItem('bugReportCooldown');
      }
    }
  }, []);

  useEffect(() => {
    if (cooldownEnd) {
      const interval = setInterval(() => {
        const remaining = cooldownEnd - Date.now();
        if (remaining <= 0) {
          setCooldownEnd(null);
          setCooldownRemaining(0);
          localStorage.removeItem('bugReportCooldown');
        } else {
          setCooldownRemaining(remaining);
        }
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [cooldownEnd]);

  useEffect(() => {
    if (isSuccess) {
      const timer = setTimeout(() => {
        setIsSuccess(false);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [isSuccess]);

  const formatCooldown = (ms: number) => {
    const totalSeconds = Math.ceil(ms / 1000);
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  };

  const handleLogin = async () => {
    setIsLoggingIn(true);
    if (import.meta.env.DEV) {
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
    setIsLoggingIn(false);
    setIsAuthenticated(true);
  };

  const handleSubmit = async () => {
    if (!title || !description || cooldownEnd) return;

    setIsSubmitting(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setIsSubmitting(false);

    if (!import.meta.env.DEV) {
      const end = Date.now() + 20 * 60 * 1000;
      localStorage.setItem('bugReportCooldown', end.toString());
      setCooldownEnd(end);
      setCooldownRemaining(end - Date.now());
    }

    const fire = (angle: number, x: number) => {
      confetti({
        particleCount: 25,
        angle,
        spread: 50,
        origin: { x, y: 0.8 },
        colors: ['#5865F2', '#57F287', '#FEE75C', '#EB459E', '#ED4245'],
        zIndex: 9999,
        scalar: 1.0,
        gravity: 0.9,
        drift: x === 0 ? 0.4 : -0.4,
        disableForReducedMotion: true,
      });
    };

    fire(60, 0);
    fire(120, 1);

    setTimeout(() => {
      confetti({
        particleCount: 15,
        angle: 70,
        spread: 40,
        origin: { x: 0.05, y: 0.85 },
        colors: ['#5865F2', '#57F287', '#FEE75C', '#EB459E', '#ED4245'],
        zIndex: 9999,
        scalar: 0.9,
        gravity: 1.0,
        disableForReducedMotion: true,
      });
      confetti({
        particleCount: 15,
        angle: 110,
        spread: 40,
        origin: { x: 0.95, y: 0.85 },
        colors: ['#5865F2', '#57F287', '#FEE75C', '#EB459E', '#ED4245'],
        zIndex: 9999,
        scalar: 0.9,
        gravity: 1.0,
        disableForReducedMotion: true,
      });
    }, 250);

    setIsSuccess(true);
    setTitle('');
    setDescription('');
    setSteps('');
    setAttachments([]);
  };

  const handleAttach = async () => {
    const selected = await openDialog({
      multiple: true,
      filters: [{ name: 'Images & Logs', extensions: ['png', 'jpg', 'jpeg', 'log', 'txt', 'zip'] }],
    });
    if (Array.isArray(selected)) {
      setAttachments((prev) => [...prev, ...selected]);
    } else if (selected) {
      setAttachments((prev) => [...prev, selected]);
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  if (!isAuthenticated) {
    return (
      <motion.div
        variants={pageVariants}
        initial="hidden"
        animate="show"
        exit="exit"
        className="tour-report-bug-page w-full h-full"
      >
        <Window>
          <motion.div
            variants={itemVariants}
            className="flex h-full min-h-[460px] flex-col justify-center"
          >
            <div className="mx-auto flex w-full max-w-[440px] flex-col">
              <div className="mb-7 text-center">
                <h1 className="text-2xl font-bold tracking-tight text-text-primary">
                  Login Required
                </h1>
                <p className="mt-2 text-sm font-medium leading-6 text-text-muted">
                  Sign in with Discord so we can follow up on your report.
                </p>
              </div>

              <div className="mb-7 flex flex-col gap-2.5">
                {consentItems.map((text, i) => {
                  const checked = termsAgreed[i];
                  return (
                    <label
                      key={text}
                      className={`group flex cursor-pointer items-center gap-3 rounded-[var(--radius-md)] border px-3.5 py-3 transition-all ${
                        checked
                          ? 'border-primary bg-primary/10'
                          : 'border-border-subtle bg-bg-elevated/40 hover:border-primary/50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleTerm(i)}
                        className="sr-only"
                      />
                      <span
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-[4px] border-2 transition-all ${
                          checked
                            ? 'border-primary bg-primary'
                            : 'border-border-strong bg-bg-base group-hover:border-primary/70'
                        }`}
                      >
                        <AnimatePresence initial={false}>
                          {checked && (
                            <motion.span
                              initial={{ scale: 0.6, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              exit={{ scale: 0.6, opacity: 0 }}
                              transition={{ duration: 0.12, ease: 'easeOut' }}
                              style={{ color: accentContrastColor }}
                            >
                              <Check size={14} strokeWidth={3} />
                            </motion.span>
                          )}
                        </AnimatePresence>
                      </span>
                      <span
                        className={`select-none text-sm font-medium leading-5 transition-colors group-hover:text-text-primary ${
                          checked ? 'text-text-primary' : 'text-text-secondary'
                        }`}
                      >
                        {text}
                      </span>
                    </label>
                  );
                })}
              </div>

              <Button
                label="Login with Discord"
                isLoading={isLoggingIn}
                onClick={handleLogin}
                disabled={!allAgreed}
                className="h-11 w-full border border-border-strong bg-bg-surface text-text-primary shadow-sm transition-colors hover:!border-[#5865F2] hover:!bg-[#5865F2] hover:!text-white disabled:cursor-not-allowed disabled:opacity-45 group"
                startContent={
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 127.14 96.36"
                    fill="currentColor"
                    className="mr-2 shrink-0"
                  >
                    <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77.7,77.7,0,0,0,6.89,11.1,105.25,105.25,0,0,0,32.19-16.14h0C127.86,52.43,122.1,28.61,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.31,60,73.31,53s5-12.74,11.43-12.74S96.3,46,96.19,53,91.08,65.69,84.69,65.69Z" />
                  </svg>
                }
              />
            </div>
          </motion.div>
        </Window>
      </motion.div>
    );
  }

  return (
    <motion.div
      variants={pageVariants}
      initial="hidden"
      animate="show"
      exit="exit"
      className="tour-report-bug-page w-full h-full"
    >
      <Window>
        <motion.div variants={itemVariants} className="w-full flex flex-col gap-8 h-full">
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-bold text-text-primary tracking-tight">Report Bug</h1>
            <p className="text-sm text-text-muted font-medium">
              Help us improve by reporting any issues you encounter.
            </p>
          </div>

          <div className="flex-1 flex flex-col justify-center min-h-[400px] relative">
            <AnimatePresence mode="wait">
              {isSuccess ? (
                <motion.div
                  key="success"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-center justify-center w-full h-full text-center absolute inset-0"
                >
                  <motion.div
                    initial={{ scale: 0, rotate: -45 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{
                      type: 'spring',
                      stiffness: 260,
                      damping: 18,
                      delay: 0.1,
                    }}
                    className="w-20 h-20 flex items-center justify-center mb-6"
                  >
                    <img
                      src={appIcon}
                      alt="ISpooferMotion Logo"
                      className="w-full h-full object-contain drop-shadow-2xl"
                    />
                  </motion.div>

                  <motion.h2
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      type: 'spring',
                      stiffness: 150,
                      damping: 15,
                      delay: 0.25,
                    }}
                    className="text-3xl font-extrabold text-text-primary mb-3 tracking-tight"
                  >
                    Report Submitted!
                  </motion.h2>
                  <motion.p
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      type: 'spring',
                      stiffness: 150,
                      damping: 15,
                      delay: 0.35,
                    }}
                    className="text-base text-text-muted max-w-sm leading-relaxed"
                  >
                    Thank you for making ISpooferMotion better. Our team will review your report
                    shortly.
                  </motion.p>
                </motion.div>
              ) : (
                <motion.div
                  key="form"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="w-full flex flex-col gap-6 mt-8"
                >
                  <div className="flex items-center justify-end mb-2">
                    <div className="flex items-center gap-2 bg-bg-surface border border-border-subtle rounded-full pl-1 pr-3 py-1 shadow-sm">
                      <img
                        src="https://cdn.discordapp.com/embed/avatars/0.png"
                        alt="Avatar"
                        className="w-6 h-6 rounded-full object-cover"
                      />
                      <span className="text-xs font-semibold text-text-primary tracking-wide">
                        IncrediDev#1234
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="flex-1">
                      <FormInput
                        label="Bug Title"
                        placeholder="Brief summary of the issue"
                        value={title}
                        onChange={setTitle}
                      />
                    </div>
                    <div>
                      <FormDropdown
                        label="Category"
                        options={[
                          { label: 'User Interface', value: 'ui' },
                          { label: 'Authentication', value: 'auth' },
                          { label: 'Core Features', value: 'core' },
                          { label: 'Plugin', value: 'plugin' },
                          { label: 'Performance', value: 'perf' },
                          { label: 'Other', value: 'other' },
                        ]}
                        value={category}
                        onChange={setCategory}
                        width="w-[180px]"
                      />
                    </div>
                  </div>

                  <FormTextarea
                    label="Description"
                    placeholder="Describe the bug in detail..."
                    value={description}
                    onChange={setDescription}
                    className="h-[120px]"
                  />

                  <FormTextarea
                    label={
                      <span>
                        Steps to Reproduce{' '}
                        <span className="text-text-muted font-normal text-xs">(Optional)</span>
                      </span>
                    }
                    placeholder={'1. Go to...\n2. Click on...\n3. See error...'}
                    value={steps}
                    onChange={setSteps}
                    className="h-[120px]"
                  />

                  <div className="w-full h-px bg-gradient-to-r from-transparent via-border-strong to-transparent mt-2" />

                  <div className="flex flex-col gap-3 pt-2">
                    {attachments.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {attachments.map((path, i) => {
                          const filename = path.split('\\').pop()?.split('/').pop() || 'file';
                          return (
                            <div
                              key={i}
                              className="flex items-center gap-1.5 bg-bg-elevated border border-border-subtle rounded text-xs px-2 py-1 text-text-secondary"
                            >
                              <span className="truncate max-w-[150px]">{filename}</span>
                              <button
                                type="button"
                                onClick={() => removeAttachment(i)}
                                className="hover:text-danger"
                              >
                                <X size={12} />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <Button
                        variant="ghost"
                        onClick={handleAttach}
                        className="text-text-secondary hover:text-text-primary px-3 h-10 flex items-center gap-2"
                      >
                        <Paperclip size={16} />
                        Attach Files
                      </Button>
                      <Button
                        label={
                          cooldownEnd !== null
                            ? `Available in ${formatCooldown(cooldownRemaining)}`
                            : 'Submit Report'
                        }
                        color="primary"
                        className="px-6 shadow-md transition-all min-w-[160px]"
                        isLoading={isSubmitting}
                        onClick={handleSubmit}
                        disabled={!title || !description || cooldownEnd !== null}
                      />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </Window>
    </motion.div>
  );
}

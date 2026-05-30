import { motion } from 'framer-motion';
import React from 'react';

export const uiMotion = {
  spring: { type: 'spring', stiffness: 360, damping: 32 },
  soft: { duration: 0.18, ease: [0.2, 0, 0, 1] },
} as const;

import Lenis from 'lenis';

export const Window: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = '',
}) => {
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!scrollRef.current) return;

    const lenis = new Lenis({
      wrapper: scrollRef.current,
      content: scrollRef.current.firstElementChild as HTMLElement,
      lerp: 0.12,
      smoothWheel: true,
      wheelMultiplier: 1.2,
    });

    function raf(time: number) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }
    const rafId = requestAnimationFrame(raf);

    const handleLenisScroll = (e: any) => {
      if (e.detail?.target) {
        lenis.scrollTo(e.detail.target, { offset: e.detail.offset || 0 });
      }
    };
    window.addEventListener('lenis-scroll', handleLenisScroll);

    return () => {
      lenis.destroy();
      cancelAnimationFrame(rafId);
      window.removeEventListener('lenis-scroll', handleLenisScroll);
    };
  }, []);

  return (
    <div
      ref={scrollRef}
      className={`w-full h-full p-8 md:p-12 overflow-y-auto flex flex-col items-center bg-transparent text-text-primary ${className}`}
    >
      <div className="w-full max-w-4xl flex flex-col gap-8 pb-48 min-h-[calc(100vh-160px)]">
        {children}
      </div>
    </div>
  );
};

export const Section: React.FC<{
  title?: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}> = ({ title, description, icon, children, className = '' }) => (
  <section className={`flex flex-col gap-4 w-full ${className}`}>
    {(title || description) && (
      <div className="flex flex-col gap-1 mb-1">
        {title && (
          <h2 className="text-base font-semibold text-text-primary flex items-center gap-2">
            {icon && <span className="text-text-muted">{icon}</span>}
            {title}
          </h2>
        )}
        {description && <p className="text-sm text-text-muted">{description}</p>}
      </div>
    )}
    <div className="flex flex-col overflow-hidden rounded-[var(--radius-lg)] border border-border-subtle bg-bg-surface shadow-subtle">
      {children}
    </div>
  </section>
);

export const Group: React.FC<{
  title?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}> = ({ title, children, className = '' }) => (
  <div className={`flex flex-col ${title ? 'pt-5' : ''} ${className}`}>
    {title ? (
      <div className="flex items-center w-full px-5 pt-5 pb-2">
        <div className="flex-shrink-0 pr-4 text-[11px] font-bold uppercase tracking-widest text-text-muted">
          {title}
        </div>
        <div className="flex-grow h-px bg-gradient-to-r from-border-strong/50 from-[85%] to-border-strong/10"></div>
      </div>
    ) : null}
    <div className="flex flex-col px-5 pb-5 pt-3 gap-5">{children}</div>
  </div>
);

export const Row: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = '',
}) => (
  <div className={`flex items-center justify-between gap-4 w-full ${className}`}>{children}</div>
);

export const Stack: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = '',
}) => <div className={`flex flex-col gap-4 w-full ${className}`}>{children}</div>;

export const Divider: React.FC<{ className?: string }> = ({ className = '' }) => (
  <hr className={`border-0 border-t border-border-subtle my-3 w-full ${className}`} />
);

export const Toolbar: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = '',
}) => <div className={`flex items-center gap-1.5 ${className}`}>{children}</div>;

export const IconButton: React.FC<{
  children: React.ReactNode;
  label: string;
  onClick?: () => void;
  tone?: 'default' | 'danger' | 'primary' | 'warning';
  className?: string;
}> = ({ children, label, onClick, tone = 'default', className = '' }) => {
  const toneClass = {
    default: 'text-text-secondary hover:text-text-primary hover:bg-bg-elevated',
    danger: 'text-text-secondary hover:text-white hover:bg-danger/80',
    primary: 'text-text-secondary hover:text-primary hover:bg-primary/10',
    warning: 'text-warning hover:text-warning hover:bg-warning/10',
  }[tone];

  return (
    <motion.button
      type="button"
      aria-label={label}
      onClick={onClick}
      whileHover={{ scale: 1.04 }}
      whileTap={{ scale: 0.95 }}
      transition={uiMotion.soft}
      className={`h-8 w-8 rounded-[var(--radius-md)] inline-flex items-center justify-center transition-colors cursor-pointer ${toneClass} ${className}`}
    >
      {children}
    </motion.button>
  );
};

export const StatusPill: React.FC<{
  label: React.ReactNode;
  tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'primary';
  dot?: boolean;
  className?: string;
}> = ({ label, tone = 'neutral', dot = true, className = '' }) => {
  const toneClass = {
    neutral: 'text-text-muted bg-bg-elevated border-border-subtle',
    success: 'text-success bg-success/10 border-success/20',
    warning: 'text-warning bg-warning/10 border-warning/20',
    danger: 'text-danger bg-danger/10 border-danger/20',
    primary: 'text-primary bg-transparent border-transparent',
  }[tone];

  return (
    <span
      className={`inline-flex h-6 items-center gap-1.5 rounded-[var(--radius-sm)] border px-2 text-[10px] font-bold uppercase tracking-wider ${toneClass} ${className}`}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {label}
    </span>
  );
};

export const EmptyState: React.FC<{
  icon?: React.ReactNode;
  title: string;
  description?: string;
  className?: string;
}> = ({ icon, title, description, className = '' }) => (
  <div className={`flex-1 flex flex-col items-center justify-center p-8 text-center ${className}`}>
    {icon && (
      <div className="w-16 h-16 rounded-full bg-bg-elevated flex items-center justify-center mb-4 border border-border-subtle shadow-subtle text-text-muted">
        {icon}
      </div>
    )}
    <h3 className="text-sm font-semibold text-text-primary tracking-tight">{title}</h3>
    {description && (
      <p className="text-xs text-text-muted font-medium mt-1 max-w-[250px] mx-auto">
        {description}
      </p>
    )}
  </div>
);

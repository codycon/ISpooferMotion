// Floating tooltip. We just use pure CSS for the hover delay to keep it simple, but use framer-motion for the fade-in.

import { AnimatePresence, motion } from 'framer-motion';
import { CircleHelp } from 'lucide-react';
import React, { useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface TooltipProps {
  content: React.ReactNode;
  children?: React.ReactNode;
  side?: 'top' | 'bottom';
}

export function Tooltip({ content, children, side = 'top' }: TooltipProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLSpanElement>(null);

  const openTooltip = () => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) {
      setCoords({
        top: side === 'top' ? rect.top - 8 : rect.bottom + 8,
        left: rect.left + rect.width / 2,
      });
    }
    setIsOpen(true);
  };

  return (
    <span
      ref={triggerRef}
      className="relative inline-flex items-center"
      onMouseEnter={openTooltip}
      onMouseLeave={() => setIsOpen(false)}
      onMouseDown={(event) => event.preventDefault()}
    >
      {children}
      {createPortal(
        <AnimatePresence>
          {isOpen && (
            <motion.span
              initial={{ opacity: 0, y: side === 'top' ? 4 : -4, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: side === 'top' ? 4 : -4, scale: 0.98 }}
              transition={{ duration: 0.14, ease: 'easeOut' }}
              className="pointer-events-none fixed z-[20000] w-72 -translate-x-1/2 rounded-[var(--radius-md)] border border-border-strong bg-bg-surface/95 px-3.5 py-2.5 text-left text-[11px] font-medium leading-5 text-text-secondary shadow-floating backdrop-blur-xl"
              style={{
                top: coords.top,
                left: coords.left,
                transformOrigin: side === 'top' ? 'bottom center' : 'top center',
                translate: side === 'top' ? '0 -100%' : '0 0',
              }}
            >
              {content}
            </motion.span>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </span>
  );
}

export function HelpTooltip({ content }: { content: React.ReactNode }) {
  return (
    <Tooltip content={content}>
      <span
        className="inline-flex h-5 w-5 select-none items-center justify-center rounded-full text-text-muted transition-colors hover:text-primary"
        aria-hidden="true"
      >
        <CircleHelp size={13} />
      </span>
    </Tooltip>
  );
}

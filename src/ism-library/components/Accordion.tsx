import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import React, { useState } from 'react';
import { useIsmConfig } from '../providers/IsmProvider';

interface AccordionProps {
  children: React.ReactNode;
  className?: string;
  defaultExpandedKeys?: string[];
  expandedKeys?: string[];
  onExpandedChange?: (keys: string[]) => void;
  selectionMode?: 'single' | 'multiple';
  autoScroll?: boolean;
}

export const Accordion: React.FC<AccordionProps> = ({
  children,
  className = '',
  defaultExpandedKeys = [],
  expandedKeys,
  onExpandedChange,
  selectionMode = 'single',
  autoScroll,
}) => {
  const [internalExpandedKeys, setInternalExpandedKeys] = useState<Set<string>>(
    new Set(defaultExpandedKeys),
  );
  const currentExpandedKeys = expandedKeys ? new Set(expandedKeys) : internalExpandedKeys;

  const toggleKey = (key: string) => {
    const next = new Set(currentExpandedKeys);
    if (next.has(key)) {
      next.delete(key);
    } else {
      if (selectionMode === 'single') next.clear();
      next.add(key);
    }
    if (expandedKeys) {
      onExpandedChange?.([...next]);
      return;
    }
    setInternalExpandedKeys(next);
    onExpandedChange?.([...next]);
  };

  return (
    <div className={`flex flex-col w-full gap-2 ${className}`}>
      {React.Children.map(children, (child) => {
        if (React.isValidElement<AccordionItemProps>(child)) {
          const key =
            child.props.value || child.key?.toString() || Math.random().toString(36).slice(2);
          return React.cloneElement(child, {
            ...child.props,
            isOpen: currentExpandedKeys.has(key),
            onToggle: () => toggleKey(key),
            autoScroll: child.props.autoScroll !== undefined ? child.props.autoScroll : autoScroll,
          });
        }
        return child;
      })}
    </div>
  );
};

export interface AccordionItemProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  value?: string;
  children: React.ReactNode;
  isOpen?: boolean;
  onToggle?: () => void;
  startContent?: React.ReactNode;
  className?: string;
  'aria-label'?: string;
  key?: string;
  autoScroll?: boolean;
}

export const AccordionItem: React.FC<AccordionItemProps> = ({
  title,
  subtitle,
  children,
  isOpen = false,
  onToggle,
  startContent,
  className = '',
  autoScroll,
}) => {
  const itemRef = React.useRef<HTMLDivElement>(null);
  const scrollTimeoutRef = React.useRef<ReturnType<typeof setTimeout>>();
  const { autoScrollAccordions } = useIsmConfig();
  const shouldAutoScroll = autoScroll !== undefined ? autoScroll : autoScrollAccordions;

  const handleToggle = () => {
    onToggle?.();
    const willBeOpen = !isOpen;

    if (willBeOpen && shouldAutoScroll) {
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
      scrollTimeoutRef.current = setTimeout(() => {
        if (itemRef.current) {
          window.dispatchEvent(
            new CustomEvent('lenis-scroll', { detail: { target: itemRef.current, offset: -24 } }),
          );
        }
      }, 150);
    }
  };

  return (
    <div
      ref={itemRef}
      className={[
        'flex flex-col overflow-hidden scroll-my-24',
        'rounded-[var(--radius-lg)] border transition-all duration-200',
        isOpen
          ? 'bg-bg-surface border-border-strong shadow-subtle'
          : 'bg-bg-surface border-border-subtle hover:border-border-strong',
        className,
      ].join(' ')}
    >
      <button
        type="button"
        onClick={handleToggle}
        className="flex items-center justify-between w-full px-5 py-4 text-left cursor-pointer select-none outline-none group"
      >
        <div className="flex items-center gap-3 overflow-hidden">
          {startContent && <div className="flex-shrink-0 text-text-muted">{startContent}</div>}
          <div className="flex flex-col truncate">
            <span className="text-sm font-semibold text-text-primary truncate tracking-tight">
              {title}
            </span>
            {subtitle && (
              <span className="text-xs text-text-muted truncate mt-0.5">{subtitle}</span>
            )}
          </div>
        </div>

        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.22, ease: [0.2, 0, 0, 1] }}
          className="flex-shrink-0 ml-3"
        >
          <ChevronDown
            size={16}
            className="text-text-muted group-hover:text-text-secondary transition-colors"
          />
        </motion.div>
      </button>

      <motion.div
        initial={false}
        animate={{
          height: isOpen ? 'auto' : 0,
          opacity: isOpen ? 1 : 0,
        }}
        transition={{ duration: 0.3, ease: [0.04, 0.62, 0.23, 0.98] }}
        className="overflow-hidden"
      >
        <div className="flex flex-col px-5 pb-5 pt-0 text-sm text-text-secondary border-t border-border-subtle">
          <div className="pt-4 flex flex-col">{children}</div>
        </div>
      </motion.div>
    </div>
  );
};

// Custom dropdown implementation that uses a portal so it doesn't get clipped by overflow hidden on parent containers.
// The math for positioning it below the anchor gets a bit tricky if the window is small, so we flip it upwards if needed.

import { autoUpdate, flip, offset, shift, size, useFloating } from '@floating-ui/react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, ChevronDown } from 'lucide-react';
import React, { useEffect, useRef, useState, memo } from 'react';
import { createPortal } from 'react-dom';

export interface DropdownOption {
  value: string;
  label: React.ReactNode;
  /** Plain-text label shown in the trigger button / selected display. Falls back to `label` if not set. */
  displayLabel?: string;
  icon?: string;
}

interface CustomDropdownProps {
  value: string;
  onChange: (value: string) => void;
  options: DropdownOption[];
  placeholder?: string;
  width?: string;
  disabled?: boolean;
}

export const Dropdown = memo(function Dropdown({
  value,
  onChange,
  options,
  placeholder = 'Select...',
  width = 'w-full',
  disabled = false,
}: CustomDropdownProps) {
  // We track the open state internally, but you can override this with controlled props if you want.
  const [isOpen, setIsOpen] = useState(false);
  const [floatingWidth, setFloatingWidth] = useState<number>(0);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((o) => o.value === value);
  const selectedLabel = selectedOption ? selectedOption.label : placeholder;

  const { x, y, strategy, refs } = useFloating({
    open: isOpen,
    placement: 'bottom-start',
    strategy: 'fixed',
    middleware: [
      offset(6),
      flip({ padding: 8 }),
      shift({ padding: 8 }),
      size({
        apply({ rects }) {
          setFloatingWidth((prev) =>
            Math.abs(prev - rects.reference.width) > 1 ? rects.reference.width : prev,
          );
        },
      }),
    ],
    whileElementsMounted: autoUpdate,
  });

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(target) &&
        refs.reference.current &&
        !(refs.reference.current as HTMLElement).contains(target)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, refs.reference]);

  return (
    <div
      className={`relative ${width}`}
      ref={refs.setReference as React.RefCallback<HTMLDivElement>}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (!disabled) setIsOpen(!isOpen);
        }}
        className="flex items-center justify-between w-full h-9 px-3 text-[13px] font-medium bg-bg-surface border border-border-strong rounded-[var(--radius-md)] text-text-primary cursor-pointer outline-none transition-all hover:border-primary/60 focus:border-primary focus:ring-1 focus:ring-primary shadow-sm disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-border-strong"
      >
        <div className="flex items-center gap-2 overflow-hidden">
          {selectedOption?.icon && (
            <img
              src={selectedOption.icon}
              className="w-4 h-4 object-contain flex-shrink-0"
              alt=""
            />
          )}
          <span className="truncate">{selectedLabel}</span>
        </div>
        <motion.div
          initial={false}
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2, ease: 'easeInOut' }}
          className="flex-shrink-0 text-text-muted"
        >
          <ChevronDown size={14} />
        </motion.div>
      </button>

      {/* Portals mount the dropdown at the very end of the DOM body, avoiding clipping issues */}
      {createPortal(
        <AnimatePresence>
          {isOpen && (
            <div
              ref={(el) => {
                dropdownRef.current = el;
                refs.setFloating(el);
              }}
              className="z-[9999]"
              style={{
                position: strategy,
                top: y ?? 0,
                left: x ?? 0,
                width: floatingWidth || undefined,
                visibility: x == null ? 'hidden' : 'visible',
              }}
            >
              <motion.div
                initial={{ opacity: 0, y: -4, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.97 }}
                transition={{ duration: 0.13, ease: 'easeOut' }}
                className="flex flex-col rounded-[var(--radius-md)] border border-border-subtle bg-bg-surface shadow-floating overflow-hidden"
                style={{
                  maxHeight: '300px',
                  overflowY: 'auto',
                }}
              >
                {options.map((opt) => {
                  const isSelected = value === opt.value;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => {
                        onChange(opt.value);
                        setIsOpen(false);
                      }}
                      className={`w-full flex items-center justify-between text-left px-3 py-2 text-[13px] outline-none transition-colors ${
                        isSelected
                          ? 'bg-primary/10 text-primary font-semibold'
                          : 'text-text-primary hover:bg-bg-elevated'
                      }`}
                    >
                      <div className="flex items-center gap-2 overflow-hidden">
                        {opt.icon && (
                          <img
                            src={opt.icon}
                            className="w-4 h-4 object-contain flex-shrink-0"
                            alt=""
                          />
                        )}
                        <span className="truncate">{opt.label}</span>
                      </div>
                      {isSelected && <Check size={14} className="flex-shrink-0 opacity-100" />}
                    </button>
                  );
                })}
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </div>
  );
});

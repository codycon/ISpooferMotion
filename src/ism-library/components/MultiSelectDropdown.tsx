// Similar to the regular Dropdown, but keeps track of multiple selections.
// We keep the dropdown open when you click an option so you can select multiple without it closing instantly.

import { autoUpdate, flip, offset, shift, size, useFloating } from '@floating-ui/react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useThemeAccent } from '../theme/ThemeProvider';
import { getAutoContrastColor } from '../utils/colors';
import { DropdownOption } from './Dropdown';

interface MultiSelectDropdownProps {
  values: string[];
  onChange: (values: string[]) => void;
  options: DropdownOption[];
  placeholder?: string;
  width?: string;
}

export function MultiSelectDropdown({
  values = [],
  onChange,
  options,
  placeholder = 'Select...',
  width = 'w-full',
}: MultiSelectDropdownProps) {
  const { accentColor } = useThemeAccent();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedLabels = values
    .map((v) => {
      const opt = options.find((o) => o.value === v);
      return opt?.displayLabel ?? (typeof opt?.label === 'string' ? opt.label : null);
    })
    .filter(Boolean)
    .join(', ');

  const displayLabel =
    values.length === options.length ? 'All' : values.length > 0 ? selectedLabels : placeholder;
  const hasSelection = values.length > 0;
  const accentContrastColor = getAutoContrastColor(accentColor);

  const { x, y, strategy, refs } = useFloating({
    open: isOpen,
    placement: 'bottom-start',
    strategy: 'fixed',
    middleware: [
      offset(6),
      flip({ padding: 8 }),
      shift({ padding: 8 }),
      size({
        apply({ rects, elements }) {
          Object.assign(elements.floating.style, {
            width: `${rects.reference.width}px`,
          });
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

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Add or remove the selected option from the array without closing the menu.
  const toggleOption = (optValue: string) => {
    if (values.includes(optValue)) {
      onChange(values.filter((v) => v !== optValue));
    } else {
      onChange([...values, optValue]);
    }
  };

  return (
    <div
      className={`relative ${width}`}
      ref={refs.setReference as React.RefCallback<HTMLDivElement>}
      onPointerDown={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          setIsOpen((prev) => !prev);
        }}
        className="flex items-center justify-between w-full h-9 px-3 text-[13px] font-medium bg-bg-surface border border-border-strong rounded-[var(--radius-md)] text-text-primary cursor-pointer outline-none transition-all hover:border-primary/60 focus:border-primary focus:ring-1 focus:ring-primary shadow-sm"
      >
        <div className="flex-1 overflow-hidden flex items-center">
          <AnimatePresence mode="wait">
            <motion.span
              key={displayLabel}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className={`truncate pr-2 ${hasSelection ? 'text-text-primary' : 'text-text-muted'}`}
            >
              {displayLabel}
            </motion.span>
          </AnimatePresence>
        </div>
        <motion.div
          initial={false}
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2, ease: 'easeInOut' }}
          className="flex-shrink-0 text-text-muted ml-2"
        >
          <ChevronDown size={14} />
        </motion.div>
      </button>

      {createPortal(
        <AnimatePresence>
          {isOpen && (
            <div
              ref={(el) => {
                dropdownRef.current = el;
                refs.setFloating(el);
              }}
              className="z-[9999]"
              onPointerDown={(event) => event.stopPropagation()}
              onMouseDown={(event) => event.stopPropagation()}
              onClick={(event) => event.stopPropagation()}
              style={{
                position: strategy,
                top: y ?? 0,
                left: x ?? 0,
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
                  const isSelected = values.includes(opt.value);
                  return (
                    <button
                      key={opt.value}
                      onClick={() => toggleOption(opt.value)}
                      className={`group w-full flex items-center gap-3 text-left px-3 py-2 text-[13px] outline-none transition-colors ${
                        isSelected
                          ? 'text-primary bg-primary/5 hover:bg-primary/10'
                          : 'text-text-muted hover:text-text-primary hover:bg-bg-elevated'
                      }`}
                    >
                      <div className="flex-shrink-0 relative flex items-center justify-center">
                        <div
                          className={`w-[18px] h-[18px] rounded-[4px] border-2 transition-colors flex items-center justify-center ${
                            isSelected
                              ? 'bg-primary border-primary'
                              : 'bg-bg-base border-border-strong'
                          }`}
                        >
                          <AnimatePresence>
                            {isSelected && (
                              <motion.svg
                                initial={{ scale: 0, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0, opacity: 0 }}
                                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                                className="w-3 h-3"
                                style={{ color: accentContrastColor }}
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={3}
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M5 13l4 4L19 7"
                                />
                              </motion.svg>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>
                      {opt.icon && (
                        <img
                          src={opt.icon}
                          className={`w-4 h-4 object-contain flex-shrink-0 transition-all duration-200 ${
                            isSelected
                              ? ''
                              : 'opacity-50 grayscale group-hover:opacity-100 group-hover:grayscale-0'
                          }`}
                          alt=""
                        />
                      )}
                      <span className="truncate">{opt.label}</span>
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
}

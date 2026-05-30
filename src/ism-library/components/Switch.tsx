// Our custom toggle switch (looks like an iOS toggle).
// We animate the little thumb circle using framer-motion's layout prop so it glides smoothly between states.

import { motion } from 'framer-motion';
import React, { memo } from 'react';

interface SettingsSwitchProps {
  label: string | React.ReactNode;
  description?: string | React.ReactNode;
  isSelected?: boolean;
  defaultSelected?: boolean;
  onValueChange?: (isSelected: boolean) => void;
  color?: 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'default';
  fullWidth?: boolean;
}

export const Switch = memo(function Switch({
  label,
  description,
  isSelected,
  defaultSelected,
  onValueChange,
  fullWidth = true,
}: SettingsSwitchProps) {
  const [internal, setInternal] = React.useState(defaultSelected ?? false);
  const checked = isSelected !== undefined ? isSelected : internal;

  const toggle = () => {
    if (isSelected === undefined) setInternal((v) => !v);
    onValueChange?.(!checked);
  };

  return (
    <div
      role="switch"
      aria-checked={checked}
      tabIndex={0}
      onClick={toggle}
      onKeyDown={(e) => {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          toggle();
        }
      }}
      className={[
        'flex items-center py-1.5 cursor-pointer group',
        fullWidth ? 'justify-between w-full' : 'gap-4 w-fit',
        'outline-none rounded-md transition-colors duration-100',
        'focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-1 focus-visible:ring-offset-bg-base',
      ].join(' ')}
    >
      <div className="flex flex-col select-none mr-4">
        <span
          className={`text-sm font-medium transition-colors duration-100 ${checked ? 'text-text-primary' : 'text-text-secondary group-hover:text-text-primary'}`}
        >
          {label}
        </span>
        {description && (
          <span className="text-[11px] text-text-muted leading-relaxed mt-0.5">{description}</span>
        )}
      </div>

      <motion.div
        className={`relative w-9 h-5 rounded-full shrink-0 p-0.5 transition-colors duration-200 ${
          checked ? 'bg-primary' : 'bg-border-strong'
        }`}
      >
        <motion.div
          animate={{ x: checked ? 16 : 0 }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          className="w-4 h-4 rounded-full bg-bg-base shadow-sm"
        />
      </motion.div>
    </div>
  );
});

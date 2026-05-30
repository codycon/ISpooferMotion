// Our core Button primitive.
// We use Framer Motion for the scaling animations on hover/tap.
// Pro tip: If you need an icon-only button, pass the isIconOnly flag so the padding stays perfectly square.

import { HTMLMotionProps, motion, AnimatePresence } from 'framer-motion';
import React, { forwardRef, memo, isValidElement } from 'react';

const getElementKey = (el: any, fallback: string) => {
  if (isValidElement(el)) {
    return (el.type as any)?.name || (el.type as string) || fallback;
  }
  return fallback;
};

export interface ButtonProps extends Omit<HTMLMotionProps<'button'>, 'ref'> {
  variant?: 'solid' | 'flat' | 'ghost' | 'bordered';
  color?: 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'default';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  isLoading?: boolean;
  startContent?: React.ReactNode;
  endContent?: React.ReactNode;
  isIconOnly?: boolean;
  label?: React.ReactNode;
}

export const Button = memo(
  forwardRef<HTMLButtonElement, ButtonProps>(
    (
      {
        children,
        className = '',
        variant = 'solid',
        color = 'default',
        size = 'md',
        fullWidth = false,
        isLoading = false,
        startContent,
        endContent,
        isIconOnly = false,
        disabled,
        label,
        ...props
      },
      ref,
    ) => {
      // These are the core tailwind classes every button shares. Here are the custom focus rings we inject here.
      const baseClasses = [
        'relative inline-flex items-center justify-center box-border appearance-none',
        'select-none whitespace-nowrap font-medium subpixel-antialiased overflow-hidden',
        'outline-none transition-colors duration-150',
        'focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-bg-base',
      ].join(' ');

      // We swap out the padding and min-width based on the size prop. If it's an icon-only button, we force it to be perfectly square.
      const sizeClasses = {
        sm: isIconOnly ? 'w-8 h-8 min-w-8 text-sm gap-1.5' : 'px-3 min-w-16 h-8 text-sm gap-1.5',
        md: isIconOnly ? 'w-10 h-10 min-w-10 text-base gap-2' : 'px-4 min-w-20 h-10 text-sm gap-2',
        lg: isIconOnly ? 'w-12 h-12 min-w-12 text-lg gap-2' : 'px-6 min-w-24 h-12 text-base gap-2',
      };

      const radiusClasses = {
        sm: 'rounded-[var(--radius-sm)]',
        md: 'rounded-[var(--radius-md)]',
        lg: 'rounded-[var(--radius-lg)]',
      };

      // This is a bit of a massive switch statement, but it perfectly maps our semantic color tokens (primary, danger, etc.) to the background/text classes based on the variant (solid, flat, ghost).
      const getColors = () => {
        const isDefault = color === 'default';
        if (variant === 'solid') {
          if (isDefault)
            return 'bg-bg-elevated text-text-primary border border-border-strong hover:bg-border-subtle hover:border-border-strong';
          if (color === 'primary')
            return 'bg-text-primary text-bg-base hover:opacity-85 active:opacity-70';
          if (color === 'danger') return 'bg-danger text-white hover:opacity-85';
          if (color === 'success') return 'bg-success text-white hover:opacity-85';
          if (color === 'warning') return 'bg-warning text-white hover:opacity-85';
          return 'bg-text-primary text-bg-base hover:opacity-85';
        }
        if (variant === 'flat') {
          if (isDefault)
            return 'bg-transparent text-text-secondary hover:bg-bg-elevated hover:text-text-primary';
          if (color === 'danger') return 'bg-danger/10 text-danger hover:bg-danger/20';
          if (color === 'success') return 'bg-success/10 text-success hover:bg-success/20';
          if (color === 'warning') return 'bg-warning/10 text-warning hover:bg-warning/20';
          return 'bg-bg-elevated text-text-primary hover:bg-border-subtle';
        }
        if (variant === 'bordered') {
          if (isDefault)
            return 'border border-border-strong text-text-primary hover:bg-bg-elevated';
          if (color === 'danger') return 'border border-danger text-danger hover:bg-danger/10';
          if (color === 'success') return 'border border-success text-success hover:bg-success/10';
          return 'border border-border-strong text-text-primary hover:bg-bg-elevated';
        }
        if (variant === 'ghost') {
          if (isDefault) return 'text-text-secondary hover:text-text-primary hover:bg-bg-elevated';
          if (color === 'danger') return 'text-danger hover:bg-danger/10';
          if (color === 'success') return 'text-success hover:bg-success/10';
          return 'text-text-secondary hover:text-text-primary hover:bg-bg-elevated';
        }
        return '';
      };

      const widthClass = fullWidth ? 'w-full' : '';
      // We combine disabled and isLoading states here to block pointer events and dim the button.
      const disabledClass =
        disabled || isLoading
          ? 'opacity-40 cursor-not-allowed pointer-events-none'
          : 'cursor-pointer';

      return (
        <motion.button
          ref={ref}
          whileHover={!(disabled || isLoading) ? { scale: 1.012 } : undefined}
          whileTap={!(disabled || isLoading) ? { scale: 0.975 } : undefined}
          className={[
            baseClasses,
            sizeClasses[size],
            radiusClasses[size],
            getColors(),
            widthClass,
            disabledClass,
            className,
          ].join(' ')}
          disabled={disabled || isLoading}
          {...props}
        >
          <AnimatePresence mode="wait">
            {isLoading ? (
              <motion.div
                key="loading-spinner"
                initial={{ opacity: 0, scale: 0.8, y: 4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.8, y: -4 }}
                transition={{ duration: 0.15 }}
                className="flex items-center justify-center flex-shrink-0"
              >
                <svg
                  className="animate-spin h-4 w-4 text-current"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
              </motion.div>
            ) : startContent ? (
              <motion.div
                key={getElementKey(startContent, 'start-content')}
                initial={{ opacity: 0, scale: 0.8, y: 4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.8, y: -4 }}
                transition={{ duration: 0.15 }}
                className="flex items-center flex-shrink-0"
              >
                {startContent as any}
              </motion.div>
            ) : null}
          </AnimatePresence>

          {typeof (label || children) === 'string' || typeof (label || children) === 'number' ? (
            <AnimatePresence mode="wait">
              <motion.span
                key={String(label || children)}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.15 }}
                className="inline-block"
              >
                {label || (children as any)}
              </motion.span>
            </AnimatePresence>
          ) : (
            label || (children as any)
          )}

          <AnimatePresence mode="wait">
            {endContent && !isLoading ? (
              <motion.div
                key={getElementKey(endContent, 'end-content')}
                initial={{ opacity: 0, scale: 0.8, y: 4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.8, y: -4 }}
                transition={{ duration: 0.15 }}
                className="flex items-center flex-shrink-0"
              >
                {endContent as any}
              </motion.div>
            ) : null}
          </AnimatePresence>
        </motion.button>
      );
    },
  ),
);

Button.displayName = 'Button';

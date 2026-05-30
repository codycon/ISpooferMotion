// Generic input and textarea components.
// We're forcing the appearance-none class because WebKit likes to add ugly default styles to inputs.

import { motion } from 'framer-motion';
import React, { forwardRef, memo } from 'react';

export interface InputProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'placeholder'
> {
  label?: React.ReactNode;
  placeholder?: React.ReactNode;
  isInvalid?: boolean;
  errorMessage?: string;
  startContent?: React.ReactNode;
  endContent?: React.ReactNode;
  fullWidth?: boolean;
}

export const Input = memo(
  forwardRef<HTMLInputElement, InputProps>(
    (
      {
        label,
        isInvalid,
        errorMessage,
        startContent,
        endContent,
        fullWidth = true,
        className = '',
        disabled,
        placeholder,
        value,
        ...props
      },
      ref,
    ) => {
      return (
        <div className={`flex flex-col gap-1.5 ${fullWidth ? 'w-full' : 'w-auto'}`}>
          {label && (
            <label
              className={`text-[11px] font-bold uppercase tracking-widest pl-1 ${isInvalid ? 'text-danger' : 'text-text-secondary'}`}
            >
              {label}
            </label>
          )}

          <form
            className={`relative flex items-center w-full ${className}`}
            onSubmit={(event) => event.preventDefault()}
          >
            {startContent && (
              <div className="absolute left-3 z-10 text-text-muted flex items-center justify-center">
                {startContent}
              </div>
            )}
            <input
              ref={ref}
              disabled={disabled}
              value={value}
              autoComplete={
                props.type === 'password' ? (props.autoComplete ?? 'off') : props.autoComplete
              }
              className={`
              w-full h-10 bg-bg-surface border rounded-[var(--radius-md)]
              text-[13px] font-medium outline-none text-text-primary
              transition-colors shadow-inner placeholder:text-text-muted
              disabled:opacity-50 disabled:cursor-not-allowed
              ${startContent ? 'pl-9' : 'px-4'}
              ${endContent ? 'pr-9' : ''}
              ${
                isInvalid
                  ? 'border-danger focus:border-danger'
                  : 'border-border-strong focus:border-primary'
              }
            `}
              {...props}
            />
            {/* Absolute positioning for the inner icons so they float over the input text */}
            {placeholder && (!value || value === '') && (
              <div
                className={`absolute left-0 right-0 z-0 pointer-events-none flex items-center h-full truncate text-[13px] text-text-muted ${startContent ? 'pl-9' : 'pl-4'} ${endContent ? 'pr-9' : 'pr-4'}`}
              >
                {placeholder}
              </div>
            )}
            {endContent && (
              <div className="absolute right-3 text-text-muted flex items-center justify-center">
                {endContent}
              </div>
            )}
          </form>

          {isInvalid && errorMessage && (
            <motion.span
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-[10px] font-medium pl-1 text-danger"
            >
              {errorMessage}
            </motion.span>
          )}
        </div>
      );
    },
  ),
);
Input.displayName = 'Input';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  isInvalid?: boolean;
  errorMessage?: string;
  fullWidth?: boolean;
}

export const Textarea = memo(
  forwardRef<HTMLTextAreaElement, TextareaProps>(
    (
      { label, isInvalid, errorMessage, fullWidth = true, className = '', disabled, ...props },
      ref,
    ) => {
      return (
        <div className={`flex flex-col gap-1.5 ${fullWidth ? 'w-full' : 'w-auto'}`}>
          {label && (
            <label
              className={`text-[11px] font-bold uppercase tracking-widest pl-1 ${isInvalid ? 'text-danger' : 'text-text-secondary'}`}
            >
              {label}
            </label>
          )}

          <div className={`relative flex w-full ${className}`}>
            <textarea
              ref={ref}
              disabled={disabled}
              className={`
              w-full h-full min-h-[80px] bg-bg-surface border rounded-[var(--radius-md)]
              text-[13px] font-medium outline-none text-text-primary
              transition-colors shadow-inner placeholder:text-text-muted p-3
              resize-none disabled:opacity-50 disabled:cursor-not-allowed
              ${
                isInvalid
                  ? 'border-danger focus:border-danger'
                  : 'border-border-strong focus:border-primary'
              }
            `}
              {...props}
            />
          </div>

          {isInvalid && errorMessage && (
            <motion.span
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-[10px] font-medium pl-1 text-danger"
            >
              {errorMessage}
            </motion.span>
          )}
        </div>
      );
    },
  ),
);
Textarea.displayName = 'Textarea';

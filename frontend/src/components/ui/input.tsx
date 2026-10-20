import React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  label?: string;
  hint?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = 'text', error, label, hint, id, ...props }, ref) => {
    const generatedId = React.useId();
    const inputId = id ?? generatedId;
    const errorId = `${inputId}-error`;
    const hintId = `${inputId}-hint`;

    return (
      <div className="w-full space-y-1.5 text-left">
        {label && (
          <label htmlFor={inputId} className="block text-xs font-medium text-fg">
            {label}
            {props.required && <span className="text-status-error-text ml-1" aria-hidden="true">*</span>}
          </label>
        )}
        <input
          id={inputId}
          ref={ref}
          type={type}
          aria-invalid={Boolean(error)}
          aria-describedby={cn(error && errorId, hint && hintId) || undefined}
          className={cn(
            'flex h-9 w-full rounded-md border border-border bg-surface px-3 py-1.5 text-sm shadow-subtle transition-colors placeholder:text-fg-muted focus-ring disabled:cursor-not-allowed disabled:opacity-50',
            error && 'border-status-error-border focus-visible:ring-status-error-text/40',
            className,
          )}
          {...props}
        />
        {hint && !error && (
          <p id={hintId} className="text-xs text-fg-muted">
            {hint}
          </p>
        )}
        {error && (
          <p id={errorId} className="text-xs text-status-error-text font-medium" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  },
);

Input.displayName = 'Input';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: string;
  label?: string;
  hint?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, label, hint, id, rows = 3, ...props }, ref) => {
    const generatedId = React.useId();
    const inputId = id ?? generatedId;
    const errorId = `${inputId}-error`;
    const hintId = `${inputId}-hint`;

    return (
      <div className="w-full space-y-1.5 text-left">
        {label && (
          <label htmlFor={inputId} className="block text-xs font-medium text-fg">
            {label}
            {props.required && <span className="text-status-error-text ml-1" aria-hidden="true">*</span>}
          </label>
        )}
        <textarea
          id={inputId}
          ref={ref}
          rows={rows}
          aria-invalid={Boolean(error)}
          aria-describedby={cn(error && errorId, hint && hintId) || undefined}
          className={cn(
            'flex w-full rounded-md border border-border bg-surface px-3 py-2 text-sm shadow-subtle transition-colors placeholder:text-fg-muted focus-ring disabled:cursor-not-allowed disabled:opacity-50',
            error && 'border-status-error-border focus-visible:ring-status-error-text/40',
            className,
          )}
          {...props}
        />
        {hint && !error && (
          <p id={hintId} className="text-xs text-fg-muted">
            {hint}
          </p>
        )}
        {error && (
          <p id={errorId} className="text-xs text-status-error-text font-medium" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  },
);

Textarea.displayName = 'Textarea';

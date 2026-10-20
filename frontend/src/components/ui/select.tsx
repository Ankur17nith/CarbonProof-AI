import React from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown } from 'lucide-react';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, hint, id, children, ...props }, ref) => {
    const generatedId = React.useId();
    const selectId = id ?? generatedId;
    const errorId = `${selectId}-error`;
    const hintId = `${selectId}-hint`;

    return (
      <div className="w-full space-y-1.5 text-left">
        {label && (
          <label htmlFor={selectId} className="block text-xs font-medium text-fg">
            {label}
            {props.required && <span className="text-status-error-text ml-1" aria-hidden="true">*</span>}
          </label>
        )}
        <div className="relative">
          <select
            id={selectId}
            ref={ref}
            aria-invalid={Boolean(error)}
            aria-describedby={cn(error && errorId, hint && hintId) || undefined}
            className={cn(
              'flex h-9 w-full appearance-none rounded-md border border-border bg-surface px-3 py-1.5 pr-8 text-sm shadow-subtle transition-colors focus-ring disabled:cursor-not-allowed disabled:opacity-50 text-fg',
              error && 'border-status-error-border focus-visible:ring-status-error-text/40',
              className,
            )}
            {...props}
          >
            {children}
          </select>
          <ChevronDown
            className="pointer-events-none absolute right-2.5 top-2.5 h-4 w-4 text-fg-muted"
            aria-hidden="true"
          />
        </div>
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

Select.displayName = 'Select';

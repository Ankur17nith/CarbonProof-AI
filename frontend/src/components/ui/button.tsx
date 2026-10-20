import React from 'react';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      isLoading = false,
      disabled,
      children,
      ...props
    },
    ref,
  ) => {
    const baseStyles =
      'inline-flex items-center justify-center font-medium transition-colors focus-ring disabled:opacity-50 disabled:pointer-events-none select-none rounded-md';

    const variants = {
      primary:
        'bg-accent text-white hover:bg-accent-hover active:bg-accent-hover/90 shadow-subtle',
      secondary:
        'bg-surface-secondary text-fg hover:bg-surface-hover border border-border/80',
      outline:
        'bg-transparent border border-border text-fg hover:bg-surface-secondary active:bg-surface-hover',
      ghost:
        'bg-transparent text-fg hover:bg-surface-secondary active:bg-surface-hover',
      danger:
        'bg-status-error-bg text-status-error-text border border-status-error-border hover:bg-status-error-bg/80',
    };

    const sizes = {
      sm: 'text-xs px-2.5 py-1.5 h-8 gap-1.5',
      md: 'text-sm px-3.5 py-2 h-9 gap-2',
      lg: 'text-base px-4 py-2.5 h-11 gap-2.5',
      icon: 'h-9 w-9 p-0',
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        {...props}
      >
        {isLoading && <Loader2 className="h-4 w-4 animate-spin text-current" />}
        {children}
      </button>
    );
  },
);

Button.displayName = 'Button';

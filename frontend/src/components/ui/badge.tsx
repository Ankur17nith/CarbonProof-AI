import React from 'react';
import { cn } from '@/lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'outline' | 'success' | 'warning' | 'error' | 'info';
}

export function Badge({
  className,
  variant = 'default',
  children,
  ...props
}: BadgeProps) {
  const base =
    'inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium tracking-tight border';

  const variants = {
    default: 'bg-surface-secondary text-fg-secondary border-border',
    outline: 'bg-transparent text-fg border-border',
    success: 'bg-status-success-bg text-status-success-text border-status-success-border',
    warning: 'bg-status-warning-bg text-status-warning-text border-status-warning-border',
    error: 'bg-status-error-bg text-status-error-text border-status-error-border',
    info: 'bg-status-info-bg text-status-info-text border-status-info-border',
  };

  return (
    <span className={cn(base, variants[variant], className)} {...props}>
      {children}
    </span>
  );
}

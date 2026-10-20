import React from 'react';
import { Menu, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { Badge } from '@/components/ui/badge';

interface HeaderProps {
  onOpenSidebar: () => void;
  title?: string;
  breadcrumb?: string;
}

export function Header({ onOpenSidebar, title, breadcrumb }: HeaderProps) {
  const { user } = useAuth();

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-border/70 bg-surface/90 px-4 sm:px-6 backdrop-blur-md">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onOpenSidebar}
          aria-label="Open navigation menu"
          className="rounded-md p-1.5 text-fg-secondary hover:bg-surface-secondary lg:hidden focus-ring"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="flex flex-col">
          {breadcrumb && (
            <span className="text-[11px] font-medium text-fg-muted tracking-tight">
              {breadcrumb}
            </span>
          )}
          <h1 className="text-base font-semibold tracking-tight text-fg">
            {title ?? 'Verification Workspace'}
          </h1>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Environment status banner */}
        <div className="hidden sm:flex items-center gap-2 rounded-full border border-border bg-surface-secondary/50 px-2.5 py-1 text-[11px] text-fg-secondary">
          <span className="h-2 w-2 rounded-full bg-accent animate-pulse" aria-hidden="true" />
          <span className="font-mono text-[10px]">Local Verification Engine</span>
        </div>

        {user && (
          <Badge variant="outline" className="text-[11px] font-mono capitalize">
            {user.role.toLowerCase()}
          </Badge>
        )}
      </div>
    </header>
  );
}

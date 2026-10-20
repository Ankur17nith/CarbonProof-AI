import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  FolderTree,
  FileCheck2,
  BrainCircuit,
  ClipboardList,
  Coins,
  History,
  ShieldCheck,
  LogOut,
  ChevronRight,
  Sun,
  Moon,
} from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  isDark: boolean;
  onToggleTheme: () => void;
}

export function Sidebar({ isOpen, onClose, isDark, onToggleTheme }: SidebarProps) {
  const { user, role, logout } = useAuth();

  const navItems = [
    { label: 'Overview', to: '/', icon: LayoutDashboard },
    { label: 'Projects', to: '/projects', icon: FolderTree },
    { label: 'Evidence', to: '/evidence', icon: FileCheck2 },
    { label: 'Assessments', to: '/assessments', icon: BrainCircuit },
    ...(role === 'REVIEWER' || role === 'ADMIN'
      ? [{ label: 'Review Queue', to: '/reviews', icon: ClipboardList }]
      : []),
    { label: 'Credit Registry', to: '/credits', icon: Coins },
    ...(role === 'ADMIN'
      ? [{ label: 'Audit Trail', to: '/audit', icon: History }]
      : []),
    { label: 'Public Verification', to: '/public', icon: ShieldCheck },
  ];

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-border bg-surface transition-transform duration-200 ease-in-out lg:static lg:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full',
        )}
        aria-label="Sidebar Navigation"
      >
        {/* Brand header */}
        <div className="flex h-16 items-center gap-3 border-b border-border/70 px-5">
          <img src="/logo.svg" alt="" className="h-7 w-7 flex-shrink-0" aria-hidden="true" />
          <div className="flex flex-col">
            <span className="text-sm font-semibold tracking-tight text-fg">CarbonProof AI</span>
            <span className="text-[10px] text-fg-muted font-mono tracking-wider uppercase">
              Verification Engine
            </span>
          </div>
        </div>

        {/* Navigation list */}
        <nav className="flex-1 space-y-1 overflow-y-auto p-3" aria-label="Main Navigation">
          <div className="px-3 py-2 text-[10px] font-semibold tracking-wider text-fg-muted uppercase">
            Platform
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={onClose}
                className={({ isActive }) =>
                  cn(
                    'group flex items-center justify-between rounded-md px-3 py-2 text-xs font-medium transition-colors focus-ring',
                    isActive
                      ? 'bg-accent/10 text-accent font-semibold'
                      : 'text-fg-secondary hover:bg-surface-secondary hover:text-fg',
                  )
                }
              >
                <div className="flex items-center gap-2.5">
                  <Icon className="h-4 w-4 flex-shrink-0 text-current" aria-hidden="true" />
                  <span>{item.label}</span>
                </div>
                <ChevronRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-60 transition-opacity" />
              </NavLink>
            );
          })}
        </nav>

        {/* User profile & footer */}
        <div className="border-t border-border/70 p-3 space-y-2">
          {user ? (
            <div className="rounded-lg bg-surface-secondary/60 p-2.5 flex items-center justify-between">
              <div className="flex flex-col min-w-0 pr-2">
                <span className="truncate text-xs font-medium text-fg">{user.displayName}</span>
                <span className="text-[10px] text-fg-muted font-mono capitalize">{user.role}</span>
              </div>
              <button
                type="button"
                onClick={logout}
                title="Log out"
                aria-label="Log out"
                className="rounded p-1 text-fg-muted hover:bg-surface-secondary hover:text-fg focus-ring"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="p-1">
              <NavLink
                to="/login"
                className="block text-center text-xs font-medium text-accent hover:underline py-1.5"
              >
                Sign In to Platform
              </NavLink>
            </div>
          )}

          <div className="flex items-center justify-between px-2 pt-1 text-[11px] text-fg-muted">
            <span>Theme</span>
            <button
              type="button"
              onClick={onToggleTheme}
              aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
              className="flex items-center gap-1.5 rounded-md px-2 py-1 hover:bg-surface-secondary text-fg-secondary transition-colors focus-ring"
            >
              {isDark ? (
                <>
                  <Sun className="h-3.5 w-3.5 text-amber-500" />
                  <span>Light</span>
                </>
              ) : (
                <>
                  <Moon className="h-3.5 w-3.5" />
                  <span>Dark</span>
                </>
              )}
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

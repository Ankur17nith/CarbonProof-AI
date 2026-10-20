import React from 'react';
import { cn } from '@/lib/utils';

export interface TabItem {
  id: string;
  label: string;
  count?: number;
}

export interface TabsProps {
  tabs: TabItem[];
  activeTab: string;
  onChange: (id: string) => void;
  className?: string;
}

export function Tabs({ tabs, activeTab, onChange, className }: TabsProps) {
  return (
    <div
      role="tablist"
      aria-orientation="horizontal"
      className={cn('flex items-center space-x-1 border-b border-border', className)}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            aria-controls={`tabpanel-${tab.id}`}
            id={`tab-${tab.id}`}
            onClick={() => onChange(tab.id)}
            className={cn(
              'group relative inline-flex items-center gap-2 px-3.5 py-2.5 text-xs font-medium transition-colors focus-ring',
              isActive
                ? 'text-accent border-b-2 border-accent font-semibold'
                : 'text-fg-secondary hover:text-fg hover:border-b-2 hover:border-border',
            )}
          >
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span
                className={cn(
                  'rounded-full px-1.5 py-0.2 text-[10px] font-mono',
                  isActive
                    ? 'bg-accent/15 text-accent'
                    : 'bg-surface-secondary text-fg-muted group-hover:text-fg',
                )}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

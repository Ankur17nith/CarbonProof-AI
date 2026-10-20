import React, { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

export function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isDark, setIsDark] = useState(() => {
    return (
      localStorage.getItem('carbonproof_theme') === 'dark' ||
      (!localStorage.getItem('carbonproof_theme') &&
        window.matchMedia('(prefers-color-scheme: dark)').matches)
    );
  });

  const location = useLocation();

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('carbonproof_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('carbonproof_theme', 'light');
    }
  }, [isDark]);

  // Derive title from current path
  const getPageInfo = (pathname: string) => {
    if (pathname === '/') return { title: 'Executive Overview', breadcrumb: 'Dashboard' };
    if (pathname.startsWith('/projects/')) return { title: 'Project Details', breadcrumb: 'Projects / Detail' };
    if (pathname === '/projects') return { title: 'Project Explorer', breadcrumb: 'Registry / Projects' };
    if (pathname === '/evidence') return { title: 'Evidence Repository', breadcrumb: 'Audit / Evidence' };
    if (pathname === '/assessments') return { title: 'Rule Verification & Findings', breadcrumb: 'AI / Assessments' };
    if (pathname === '/reviews') return { title: 'Reviewer Decision Queue', breadcrumb: 'Compliance / Review' };
    if (pathname === '/credits') return { title: 'Credit Batch Ledger', breadcrumb: 'Settlement / Credits' };
    if (pathname === '/audit') return { title: 'System Audit Trail', breadcrumb: 'Compliance / Audit' };
    if (pathname === '/public') return { title: 'Public Verification Portal', breadcrumb: 'Trust / Verification' };
    return { title: 'Verification Platform', breadcrumb: 'CarbonProof AI' };
  };

  const { title, breadcrumb } = getPageInfo(location.pathname);

  return (
    <div className="flex min-h-screen bg-background font-sans antialiased text-fg">
      {/* Skip to main content link for screen-reader and keyboard users (WCAG Landmark) */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-md focus:bg-accent focus:px-4 focus:py-2 focus:text-white focus:shadow-elevated focus:outline-none"
      >
        Skip to main content
      </a>

      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        isDark={isDark}
        onToggleTheme={() => setIsDark((prev) => !prev)}
      />

      <div className="flex flex-1 flex-col min-w-0">
        <Header
          onOpenSidebar={() => setSidebarOpen(true)}
          title={title}
          breadcrumb={breadcrumb}
        />

        <main id="main-content" className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

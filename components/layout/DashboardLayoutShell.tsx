'use client';

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar } from '@/components/layout/Sidebar';
import { Topbar } from '@/components/layout/Topbar';
import { MobileNav } from '@/components/layout/MobileNav';
import { CommandPalette } from '@/components/layout/CommandPalette';
import { cn } from '@/lib/utils';

export interface ShellBreadcrumb {
  label: string;
  href?: string;
}

const ROOT_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  dispatch: 'Dispatch Board',
  deliveries: 'Deliveries',
  trucks: 'Trucks',
  drivers: 'Drivers',
  loads: 'Load Plans',
  schedule: 'Schedule',
  settings: 'Settings',
  import: 'CSV Import',
  guide: 'Guide',
};

const SUB_LABELS: Record<string, string> = {
  new: 'New',
  recommend: 'Recommendations',
  optimize: 'Load Optimizer',
  calendar: 'Dispatch Calendar',
};

function buildBreadcrumbs(pathname: string): {
  title: string;
  breadcrumbs: ShellBreadcrumb[];
} {
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length === 0) {
    return { title: 'Dashboard', breadcrumbs: [{ label: 'Dashboard' }] };
  }

  const crumbs: ShellBreadcrumb[] = [];
  let accum = '';

  segments.forEach((seg, idx) => {
    accum += `/${seg}`;
    const isLast = idx === segments.length - 1;
    let label = ROOT_LABELS[seg] || SUB_LABELS[seg];
    if (!label) {
      label = seg.length > 10 ? `#${seg.slice(-6).toUpperCase()}` : seg;
    }
    crumbs.push({
      label,
      href: isLast ? undefined : accum,
    });
  });

  const title = crumbs[crumbs.length - 1]?.label || 'LoadFlow';
  return { title, breadcrumbs: crumbs };
}

export function DashboardLayoutShell({
  children,
  userName,
  userEmail,
  userInitial,
  companyName = 'LoadFlow Workspace',
}: {
  children: React.ReactNode;
  userName: string;
  userEmail: string;
  userInitial: string;
  companyName?: string;
}) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem('lf_sidebar_collapsed');
      if (saved === '1') setIsCollapsed(true);
    } catch {
      // Ignore storage access errors
    }
  }, []);

  const toggleCollapsed = useCallback(() => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem('lf_sidebar_collapsed', next ? '1' : '0');
      } catch {
        // Ignore
      }
      return next;
    });
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const toggleSidebar = useCallback(
    () => setSidebarOpen((prev) => !prev),
    []
  );
  const closeSidebar = useCallback(() => setSidebarOpen(false), []);
  const openCommandPalette = useCallback(() => setCommandOpen(true), []);
  const closeCommandPalette = useCallback(() => setCommandOpen(false), []);

  const { title, breadcrumbs } = useMemo(
    () => buildBreadcrumbs(pathname),
    [pathname]
  );

  return (
    <div className="min-h-screen bg-canvas">
      <Sidebar
        isOpen={sidebarOpen}
        isCollapsed={isCollapsed}
        onToggleCollapse={toggleCollapsed}
        onClose={closeSidebar}
        userName={userName}
        userEmail={userEmail}
        userInitial={userInitial}
        companyName={companyName}
      />

      <div
        className={cn(
          'flex min-h-screen flex-col transition-[padding] duration-200 ease-in-out',
          isCollapsed ? 'md:pl-[68px]' : 'md:pl-[252px]'
        )}
      >
        <Topbar
          title={title}
          breadcrumbs={breadcrumbs}
          companyName={companyName}
          userName={userName}
          userEmail={userEmail}
          userInitial={userInitial}
          onMenuToggle={toggleSidebar}
          onOpenSearch={openCommandPalette}
        />

        <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-6 sm:px-6 md:px-8 md:py-7 pb-24 md:pb-10">
          {children}
        </main>
      </div>

      <MobileNav />

      <CommandPalette isOpen={commandOpen} onClose={closeCommandPalette} />
    </div>
  );
}

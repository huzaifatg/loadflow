'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar } from '@/components/layout/Sidebar';
import { Topbar } from '@/components/layout/Topbar';
import { MobileNav } from '@/components/layout/MobileNav';

/* ── Map pathname → page title ───────────────────── */
const pageTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/deliveries': 'Deliveries',
  '/trucks': 'Trucks',
  '/drivers': 'Drivers',
  '/loads': 'Load Plans',
  '/schedule': 'Schedule',
  '/settings': 'Settings',
};

function getPageTitle(pathname: string): string {
  if (pageTitles[pathname]) return pageTitles[pathname];
  // Match parent path, e.g. /deliveries/123 → Deliveries
  const parent = Object.keys(pageTitles).find((p) =>
    pathname.startsWith(p + '/')
  );
  return parent ? pageTitles[parent] : 'LoadFlow';
}

/* ── Layout component ────────────────────────────── */
export function DashboardLayoutShell({
  children,
  userName,
  userEmail,
  userInitial,
}: {
  children: React.ReactNode;
  userName: string;
  userEmail: string;
  userInitial: string;
}) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const toggleSidebar = useCallback(
    () => setSidebarOpen((prev) => !prev),
    []
  );
  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  const title = useMemo(() => getPageTitle(pathname), [pathname]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar */}
      <Sidebar 
        isOpen={sidebarOpen} 
        onClose={closeSidebar} 
        userName={userName}
        userEmail={userEmail}
        userInitial={userInitial}
      />

      {/* Main area – offset by sidebar on desktop */}
      <div className="flex flex-col md:pl-[260px]">
        {/* Topbar */}
        <Topbar 
          title={title} 
          onMenuToggle={toggleSidebar} 
          userInitial={userInitial}
        />

        {/* Content */}
        <main className="flex-1 px-4 py-6 md:px-8 md:py-8 pb-20 md:pb-8">
          {children}
        </main>
      </div>

      {/* Mobile bottom nav */}
      <MobileNav />
    </div>
  );
}

'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Package,
  Truck,
  Users,
  ClipboardList,
  Calendar,
  Settings,
  LogOut,
  X,
  BoxesIcon,
  BookOpen,
  FileUp,
  Sparkles,
  SlidersHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  Building2,
  Kanban,
} from 'lucide-react';

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  exact?: boolean;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    title: 'Overview',
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, exact: true },
      { label: 'Dispatch Board', href: '/dispatch', icon: Kanban, exact: true },
      { label: 'Dispatch Calendar', href: '/dispatch/calendar', icon: Calendar },
    ],
  },
  {
    title: 'Operations',
    items: [
      { label: 'Load Plans', href: '/loads', icon: ClipboardList, exact: true },
      { label: 'Deliveries', href: '/deliveries', icon: Package },
      { label: 'Recommendations', href: '/loads/recommend', icon: Sparkles },
      { label: 'Load Optimizer', href: '/loads/optimize', icon: SlidersHorizontal },
      { label: 'CSV Import', href: '/import', icon: FileUp },
    ],
  },
  {
    title: 'Fleet',
    items: [
      { label: 'Trucks', href: '/trucks', icon: Truck },
      { label: 'Drivers', href: '/drivers', icon: Users },
    ],
  },
  {
    title: 'Workspace',
    items: [
      { label: 'Settings', href: '/settings', icon: Settings },
      { label: 'Guide', href: '/guide', icon: BookOpen },
    ],
  },
];

export interface SidebarProps {
  isOpen: boolean;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  onClose: () => void;
  userName: string;
  userEmail: string;
  userInitial: string;
  companyName?: string;
}

export function Sidebar({
  isOpen,
  isCollapsed = false,
  onToggleCollapse,
  onClose,
  userName,
  userEmail,
  userInitial,
  companyName = 'LoadFlow Workspace',
}: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/');
    router.refresh();
  };

  const isRouteActive = (item: NavItem) => {
    if (item.exact) {
      if (item.href === '/loads') {
        return (
          pathname === '/loads' ||
          (pathname.startsWith('/loads/') &&
            !pathname.startsWith('/loads/recommend') &&
            !pathname.startsWith('/loads/optimize'))
        );
      }
      return pathname === item.href;
    }
    return pathname === item.href || pathname.startsWith(item.href + '/');
  };

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-gray-900/50 backdrop-blur-[2px] md:hidden animate-fade-in"
          onClick={onClose}
          aria-hidden
        />
      )}

      <aside
        aria-label="Primary Sidebar Navigation"
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex flex-col border-r border-sidebar-border bg-sidebar-bg text-gray-300 select-none',
          'transition-all duration-200 ease-in-out md:translate-x-0',
          isCollapsed ? 'md:w-[68px]' : 'md:w-[252px]',
          'w-[260px]',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Top brand + collapse button */}
        <div
          className={cn(
            'flex h-14 items-center border-b border-sidebar-border px-3.5',
            isCollapsed ? 'md:justify-center' : 'justify-between'
          )}
        >
          <Link
            href="/dashboard"
            onClick={onClose}
            className="flex items-center gap-2.5 min-w-0"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-600 text-white shadow-xs">
              <BoxesIcon className="h-4 w-4" />
            </div>
            <div
              className={cn(
                'min-w-0 transition-opacity',
                isCollapsed && 'md:hidden'
              )}
            >
              <span className="block truncate text-sm font-bold tracking-tight text-white">
                LoadFlow
              </span>
              <span className="block truncate text-[11px] font-medium text-gray-400">
                Logistics OS v0.12
              </span>
            </div>
          </Link>

          {onToggleCollapse && !isCollapsed && (
            <button
              type="button"
              onClick={onToggleCollapse}
              className="hidden md:inline-flex rounded-lg p-1.5 text-gray-400 hover:bg-sidebar-hover hover:text-gray-200 cursor-pointer"
              aria-label="Collapse sidebar"
              title="Collapse sidebar"
            >
              <PanelLeftClose className="h-4 w-4" />
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-sidebar-hover md:hidden cursor-pointer"
            aria-label="Close sidebar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Company tenant badge */}
        <div
          className={cn(
            'border-b border-sidebar-border px-3 py-2.5',
            isCollapsed && 'md:px-2'
          )}
        >
          <div
            title={`Tenant: ${companyName}`}
            className={cn(
              'flex items-center gap-2.5 rounded-lg bg-white/[0.04] px-2.5 py-2 ring-1 ring-inset ring-white/[0.07]',
              isCollapsed && 'md:justify-center md:px-0'
            )}
          >
            <Building2 className="h-4 w-4 shrink-0 text-primary-400" />
            <div className={cn('min-w-0 flex-1', isCollapsed && 'md:hidden')}>
              <p className="truncate text-xs font-semibold text-gray-200">
                {companyName}
              </p>
              <p className="truncate text-[10px] text-gray-400">
                Active Tenant Workspace
              </p>
            </div>
          </div>
        </div>

        {/* Navigation groups */}
        <nav className="flex-1 overflow-y-auto hide-scrollbar px-2.5 py-3 space-y-4">
          {NAV_GROUPS.map((group) => (
            <div key={group.title}>
              <div
                className={cn(
                  'mb-1.5 px-2.5 text-[10px] font-semibold uppercase tracking-wider text-gray-500',
                  isCollapsed && 'md:hidden'
                )}
              >
                {group.title}
              </div>
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const active = isRouteActive(item);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={onClose}
                        title={isCollapsed ? item.label : undefined}
                        className={cn(
                          'group relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium transition-colors',
                          isCollapsed && 'md:justify-center md:px-2',
                          active
                            ? 'bg-sidebar-active text-white font-semibold'
                            : 'text-gray-400 hover:bg-sidebar-hover hover:text-gray-100'
                        )}
                      >
                        {active && (
                          <span
                            className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-r bg-primary-400"
                            aria-hidden
                          />
                        )}
                        <item.icon
                          className={cn(
                            'h-4 w-4 shrink-0 transition-colors',
                            active
                              ? 'text-primary-400'
                              : 'text-gray-400 group-hover:text-gray-200'
                          )}
                        />
                        <span className={cn('truncate', isCollapsed && 'md:hidden')}>
                          {item.label}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* Expand button when collapsed */}
        {isCollapsed && onToggleCollapse && (
          <div className="hidden md:flex justify-center pb-2">
            <button
              type="button"
              onClick={onToggleCollapse}
              className="rounded-lg p-2 text-gray-400 hover:bg-sidebar-hover hover:text-white cursor-pointer"
              aria-label="Expand sidebar"
              title="Expand sidebar"
            >
              <PanelLeftOpen className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* User Footer */}
        <div className="border-t border-sidebar-border p-3">
          <div
            className={cn(
              'flex items-center gap-2.5',
              isCollapsed && 'md:flex-col md:justify-center'
            )}
          >
            <div
              title={`${userName} (${userEmail})`}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-600/25 text-xs font-semibold text-primary-300 ring-1 ring-inset ring-primary-500/30"
            >
              {userInitial}
            </div>
            <div className={cn('min-w-0 flex-1', isCollapsed && 'md:hidden')}>
              <p className="truncate text-xs font-semibold text-gray-200">
                {userName}
              </p>
              <p className="truncate text-[11px] text-gray-400">{userEmail}</p>
            </div>
            <button
              type="button"
              onClick={handleSignOut}
              className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-sidebar-hover hover:text-rose-300 cursor-pointer"
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

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
} from 'lucide-react';

/* ── Nav items ───────────────────────────────────── */
const navItems = [
  { label: 'Dashboard', href: '/', icon: LayoutDashboard },
  { label: 'Deliveries', href: '/deliveries', icon: Package },
  { label: 'Trucks', href: '/trucks', icon: Truck },
  { label: 'Drivers', href: '/drivers', icon: Users },
  { label: 'Load Plans', href: '/loads', icon: ClipboardList },
  { label: 'Schedule', href: '/schedule', icon: Calendar },
  { label: 'Settings', href: '/settings', icon: Settings },
] as const;

/* ── Props ───────────────────────────────────────── */
export interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  userName: string;
  userEmail: string;
  userInitial: string;
}

export function Sidebar({ isOpen, onClose, userName, userEmail, userInitial }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm md:hidden animate-fade-in"
          onClick={onClose}
          aria-hidden
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-[260px] flex-col bg-sidebar-bg',
          // Mobile: slide in/out
          'transition-transform duration-200 ease-in-out md:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* ── Logo ───────────────────────────────── */}
        <div className="flex h-16 items-center justify-between px-5">
          <Link
            href="/"
            className="flex items-center gap-2.5"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-600 text-white">
              <BoxesIcon className="h-4.5 w-4.5" />
            </div>
            <span className="text-lg font-bold tracking-tight text-white">
              LoadFlow
            </span>
          </Link>

          {/* Close button – mobile only */}
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-sidebar-hover md:hidden cursor-pointer"
            aria-label="Close sidebar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* ── Navigation ─────────────────────────── */}
        <nav className="flex-1 overflow-y-auto hide-scrollbar px-3 py-4">
          <ul className="space-y-1">
            {navItems.map((item) => {
              const isActive =
                item.href === '/'
                  ? pathname === '/'
                  : pathname === item.href ||
                    pathname.startsWith(item.href + '/');

              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onClose}
                    className={cn(
                      'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-150',
                      isActive
                        ? 'bg-sidebar-active text-white'
                        : 'text-gray-400 hover:bg-sidebar-hover hover:text-gray-200'
                    )}
                  >
                    <item.icon
                      className={cn(
                        'h-[18px] w-[18px] shrink-0 transition-colors',
                        isActive
                          ? 'text-primary-400'
                          : 'text-gray-500 group-hover:text-gray-300'
                      )}
                    />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* ── User / Sign out ────────────────────── */}
        <div className="border-t border-sidebar-border p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-600/20 text-xs font-semibold text-primary-300">
              {userInitial}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-gray-200">
                {userName}
              </p>
              <p className="truncate text-xs text-gray-500 mb-1">
                {userEmail}
              </p>
              <span className="inline-flex items-center rounded-md bg-primary-500/10 px-1.5 py-0.5 text-[10px] font-medium text-primary-400 ring-1 ring-inset ring-primary-500/20">
                Dispatcher / Admin
              </span>
            </div>
            <button
              onClick={handleSignOut}
              className="rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-sidebar-hover hover:text-gray-300 cursor-pointer"
              aria-label="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

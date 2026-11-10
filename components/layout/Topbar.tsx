'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import {
  Menu,
  Search,
  Plus,
  ChevronRight,
  ClipboardList,
  Package,
  Truck,
  Users,
  FileUp,
  Settings,
  BookOpen,
  LogOut,
  Building2,
} from 'lucide-react';
import type { ShellBreadcrumb } from './DashboardLayoutShell';

export interface TopbarProps {
  title: string;
  breadcrumbs?: ShellBreadcrumb[];
  companyName?: string;
  userName?: string;
  userEmail?: string;
  userInitial: string;
  onMenuToggle: () => void;
  onOpenSearch?: () => void;
  className?: string;
}

export function Topbar({
  title,
  breadcrumbs,
  companyName,
  userName,
  userEmail,
  userInitial,
  onMenuToggle,
  onOpenSearch,
  className,
}: TopbarProps) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const createRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (createRef.current && !createRef.current.contains(e.target as Node)) {
        setCreateOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/');
    router.refresh();
  };

  return (
    <header
      className={cn(
        'sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-gray-200 bg-white/90 backdrop-blur-md px-4 sm:px-6 md:px-8',
        className
      )}
    >
      {/* Left: Mobile menu button + Breadcrumb trail */}
      <div className="flex min-w-0 items-center gap-2.5">
        <button
          type="button"
          onClick={onMenuToggle}
          className="rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800 md:hidden cursor-pointer"
          aria-label="Toggle navigation menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        {breadcrumbs && breadcrumbs.length > 0 ? (
          <nav
            aria-label="Workspace breadcrumb"
            className="flex min-w-0 items-center gap-1.5 text-xs"
          >
            <Link
              href="/dashboard"
              className="hidden sm:inline font-medium text-gray-400 hover:text-gray-700 transition-colors"
            >
              LoadFlow
            </Link>
            <ChevronRight className="hidden sm:inline h-3.5 w-3.5 shrink-0 text-gray-300" />
            {breadcrumbs.map((crumb, idx) => {
              const isLast = idx === breadcrumbs.length - 1;
              return (
                <React.Fragment key={`${crumb.label}-${idx}`}>
                  {crumb.href && !isLast ? (
                    <Link
                      href={crumb.href}
                      className="truncate font-medium text-gray-500 hover:text-gray-900 transition-colors"
                    >
                      {crumb.label}
                    </Link>
                  ) : (
                    <span className="truncate font-semibold text-gray-900">
                      {crumb.label}
                    </span>
                  )}
                  {!isLast && (
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-gray-300" />
                  )}
                </React.Fragment>
              );
            })}
          </nav>
        ) : (
          <h1 className="truncate text-sm font-semibold text-gray-900">
            {title}
          </h1>
        )}
      </div>

      {/* Right: Search trigger, Quick Create menu, Tenant badge, User menu */}
      <div className="flex items-center gap-2">
        {onOpenSearch && (
          <button
            type="button"
            onClick={onOpenSearch}
            className="inline-flex h-8 items-center gap-2.5 rounded-lg border border-gray-200 bg-gray-50/80 px-2.5 text-xs text-gray-500 shadow-2xs transition-colors hover:border-gray-300 hover:bg-gray-100/70 hover:text-gray-800 cursor-pointer"
            aria-label="Search or run a command"
          >
            <Search className="h-3.5 w-3.5 text-gray-400" />
            <span className="hidden sm:inline pr-4">
              Search deliveries, plans, fleet...
            </span>
            <kbd className="hidden md:inline-flex items-center rounded border border-gray-200 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-gray-500">
              ⌘K
            </kbd>
          </button>
        )}

        {/* Quick Create dropdown */}
        <div ref={createRef} className="relative">
          <button
            type="button"
            onClick={() => setCreateOpen((v) => !v)}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary-600 px-2.5 text-xs font-semibold text-white shadow-2xs transition-colors hover:bg-primary-700 cursor-pointer"
            aria-expanded={createOpen}
            aria-haspopup="menu"
          >
            <Plus className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Create</span>
          </button>

          {createOpen && (
            <div
              role="menu"
              className="absolute right-0 mt-1.5 w-52 rounded-xl border border-gray-200 bg-white p-1.5 shadow-lg animate-fade-in z-50"
            >
              <div className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                New Record
              </div>
              <Link
                href="/loads/new"
                onClick={() => setCreateOpen(false)}
                className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 hover:text-gray-900"
              >
                <ClipboardList className="h-4 w-4 text-primary-600" />
                <span>New Load Plan</span>
              </Link>
              <Link
                href="/deliveries/new"
                onClick={() => setCreateOpen(false)}
                className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 hover:text-gray-900"
              >
                <Package className="h-4 w-4 text-sky-600" />
                <span>New Delivery</span>
              </Link>
              <Link
                href="/trucks/new"
                onClick={() => setCreateOpen(false)}
                className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 hover:text-gray-900"
              >
                <Truck className="h-4 w-4 text-emerald-600" />
                <span>Add Truck</span>
              </Link>
              <Link
                href="/drivers/new"
                onClick={() => setCreateOpen(false)}
                className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 hover:text-gray-900"
              >
                <Users className="h-4 w-4 text-amber-600" />
                <span>Add Driver</span>
              </Link>
              <div className="my-1 border-t border-gray-100" />
              <Link
                href="/import"
                onClick={() => setCreateOpen(false)}
                className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 hover:text-gray-900"
              >
                <FileUp className="h-4 w-4 text-gray-500" />
                <span>Import CSV</span>
              </Link>
            </div>
          )}
        </div>

        {/* Company pill on large screens */}
        {companyName && (
          <div className="hidden lg:inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-600">
            <Building2 className="h-3.5 w-3.5 text-primary-600" />
            <span className="max-w-[140px] truncate">{companyName}</span>
          </div>
        )}

        {/* User profile dropdown */}
        <div ref={profileRef} className="relative">
          <button
            type="button"
            onClick={() => setProfileOpen((v) => !v)}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-50 text-xs font-semibold text-primary-700 ring-1 ring-inset ring-primary-200 hover:bg-primary-100 transition-colors cursor-pointer"
            aria-label="User menu"
            aria-expanded={profileOpen}
          >
            {userInitial}
          </button>

          {profileOpen && (
            <div
              role="menu"
              className="absolute right-0 mt-1.5 w-56 rounded-xl border border-gray-200 bg-white p-1.5 shadow-lg animate-fade-in z-50"
            >
              {(userName || userEmail) && (
                <div className="border-b border-gray-100 px-3 py-2 mb-1">
                  {userName && (
                    <p className="truncate text-xs font-semibold text-gray-900">
                      {userName}
                    </p>
                  )}
                  {userEmail && (
                    <p className="truncate text-[11px] text-gray-500">
                      {userEmail}
                    </p>
                  )}
                </div>
              )}
              <Link
                href="/settings"
                onClick={() => setProfileOpen(false)}
                className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                <Settings className="h-4 w-4 text-gray-400" />
                <span>Workspace Settings</span>
              </Link>
              <Link
                href="/guide"
                onClick={() => setProfileOpen(false)}
                className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                <BookOpen className="h-4 w-4 text-gray-400" />
                <span>Getting Started Guide</span>
              </Link>
              <div className="my-1 border-t border-gray-100" />
              <button
                type="button"
                onClick={handleSignOut}
                className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-rose-600 hover:bg-rose-50 cursor-pointer"
              >
                <LogOut className="h-4 w-4" />
                <span>Sign out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

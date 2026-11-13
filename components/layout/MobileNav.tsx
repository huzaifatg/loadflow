'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Package,
  Truck,
  ClipboardList,
  Kanban,
} from 'lucide-react';

const navItems = [
  { label: 'Overview', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Dispatch', href: '/dispatch', icon: Kanban },
  { label: 'Plans', href: '/loads', icon: ClipboardList },
  { label: 'Deliveries', href: '/deliveries', icon: Package },
  { label: 'Fleet', href: '/trucks', icon: Truck },
] as const;

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Mobile bottom navigation"
      className="fixed bottom-0 inset-x-0 z-40 border-t border-gray-200 bg-white/95 backdrop-blur-md md:hidden"
    >
      <div className="flex items-stretch">
        {navItems.map((item) => {
          const isActive =
            item.href === '/dashboard'
              ? pathname === '/dashboard'
              : pathname === item.href ||
                pathname.startsWith(item.href + '/');

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'relative flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors',
                isActive
                  ? 'text-primary-600 font-semibold'
                  : 'text-gray-500 active:text-gray-800'
              )}
            >
              {isActive && (
                <span
                  className="absolute top-0 h-0.5 w-8 rounded-b bg-primary-600"
                  aria-hidden
                />
              )}
              <item.icon
                className={cn(
                  'h-4 w-4',
                  isActive ? 'text-primary-600' : 'text-gray-400'
                )}
              />
              {item.label}
            </Link>
          );
        })}
      </div>

      <div className="h-[env(safe-area-inset-bottom)]" />
    </nav>
  );
}

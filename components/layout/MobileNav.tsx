'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Package,
  Truck,
  Users,
  ClipboardList,
} from 'lucide-react';

const navItems = [
  { label: 'Home', href: '/', icon: LayoutDashboard },
  { label: 'Deliveries', href: '/deliveries', icon: Package },
  { label: 'Trucks', href: '/trucks', icon: Truck },
  { label: 'Drivers', href: '/drivers', icon: Users },
  { label: 'Plans', href: '/loads', icon: ClipboardList },
] as const;

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 border-t border-gray-200 bg-white md:hidden">
      <div className="flex items-stretch">
        {navItems.map((item) => {
          const isActive =
            item.href === '/'
              ? pathname === '/'
              : pathname === item.href ||
                pathname.startsWith(item.href + '/');

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium transition-colors',
                isActive
                  ? 'text-primary-600'
                  : 'text-gray-400 active:text-gray-600'
              )}
            >
              <item.icon
                className={cn(
                  'h-5 w-5',
                  isActive ? 'text-primary-600' : 'text-gray-400'
                )}
              />
              {item.label}
            </Link>
          );
        })}
      </div>

      {/* Safe-area spacer for notched devices */}
      <div className="h-[env(safe-area-inset-bottom)]" />
    </nav>
  );
}

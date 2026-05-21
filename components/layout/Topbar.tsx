'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { Menu } from 'lucide-react';

export interface TopbarProps {
  title: string;
  onMenuToggle: () => void;
  className?: string;
}

export function Topbar({ title, onMenuToggle, className }: TopbarProps) {
  return (
    <header
      className={cn(
        'sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-gray-200 bg-white/80 backdrop-blur-md px-4 md:px-6',
        className
      )}
    >
      {/* Hamburger – mobile only */}
      <button
        onClick={onMenuToggle}
        className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 md:hidden cursor-pointer"
        aria-label="Toggle menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Page title */}
      <h1 className="text-lg font-semibold text-gray-900 truncate">
        {title}
      </h1>

      {/* Spacer */}
      <div className="flex-1" />

      {/* User avatar */}
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100 text-xs font-semibold text-primary-700 ring-2 ring-white">
        U
      </div>
    </header>
  );
}

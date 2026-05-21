import React from 'react';
import { cn } from '@/lib/utils';
import { Button } from './Button';
import { Plus } from 'lucide-react';
import Link from 'next/link';

interface PageHeaderProps {
  title: string;
  description?: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
  children?: React.ReactNode;
}

export function PageHeader({
  title,
  description,
  actionLabel,
  actionHref,
  onAction,
  children,
}: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">{title}</h1>
        {description && (
          <p className="mt-1 text-sm text-gray-500">{description}</p>
        )}
      </div>
      <div className="flex items-center gap-3">
        {children}
        {actionLabel && actionHref && (
          <Link href={actionHref}>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              {actionLabel}
            </Button>
          </Link>
        )}
        {actionLabel && onAction && !actionHref && (
          <Button onClick={onAction}>
            <Plus className="mr-2 h-4 w-4" />
            {actionLabel}
          </Button>
        )}
      </div>
    </div>
  );
}

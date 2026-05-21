import React from 'react';
import { cn } from '@/lib/utils';
import { InboxIcon } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-16 px-6 text-center',
        className
      )}
    >
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100 text-gray-400">
        {icon ?? <InboxIcon className="h-7 w-7" />}
      </div>

      <h3 className="text-base font-semibold text-gray-900">
        {title}
      </h3>

      {description && (
        <p className="mt-1.5 max-w-sm text-sm text-gray-500">
          {description}
        </p>
      )}

      {actionLabel && onAction && (
        <div className="mt-5">
          <Button variant="primary" size="sm" onClick={onAction}>
            {actionLabel}
          </Button>
        </div>
      )}
    </div>
  );
}

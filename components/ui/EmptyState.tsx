import React from 'react';
import { cn } from '@/lib/utils';
import { InboxIcon } from 'lucide-react';
import { Button, ButtonLink } from '@/components/ui/Button';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
  secondaryAction?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  actionHref,
  onAction,
  secondaryAction,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-14 px-6 text-center',
        className
      )}
    >
      <div className="mb-3.5 flex h-12 w-12 items-center justify-center rounded-xl border border-gray-200 bg-gray-50 text-gray-500 shadow-xs">
        {icon ?? <InboxIcon className="h-5 w-5" />}
      </div>

      <h3 className="text-sm font-semibold text-gray-900">{title}</h3>

      {description && (
        <p className="mt-1 max-w-md text-xs leading-relaxed text-gray-500">
          {description}
        </p>
      )}

      {(actionLabel && (actionHref || onAction)) || secondaryAction ? (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2.5">
          {actionLabel && actionHref && (
            <ButtonLink href={actionHref} variant="primary" size="sm">
              {actionLabel}
            </ButtonLink>
          )}
          {actionLabel && onAction && !actionHref && (
            <Button variant="primary" size="sm" onClick={onAction}>
              {actionLabel}
            </Button>
          )}
          {secondaryAction}
        </div>
      ) : null}
    </div>
  );
}

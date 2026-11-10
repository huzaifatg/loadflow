import React from 'react';
import Link from 'next/link';
import { Button, ButtonLink } from './Button';
import { ChevronRight, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface PageHeaderProps {
  title: string;
  description?: string;
  eyebrow?: string;
  breadcrumbs?: BreadcrumbItem[];
  meta?: React.ReactNode;
  actionLabel?: string;
  actionHref?: string;
  actionIcon?: React.ReactNode;
  onAction?: () => void;
  children?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  description,
  eyebrow,
  breadcrumbs,
  meta,
  actionLabel,
  actionHref,
  actionIcon,
  onAction,
  children,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        'mb-6 flex flex-col gap-4 border-b border-gray-200/80 pb-5 sm:flex-row sm:items-start sm:justify-between',
        className
      )}
    >
      <div className="min-w-0 flex-1">
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav
            aria-label="Breadcrumb"
            className="mb-2 flex flex-wrap items-center gap-1.5 text-xs font-medium text-gray-500"
          >
            {breadcrumbs.map((crumb, idx) => {
              const isLast = idx === breadcrumbs.length - 1;
              return (
                <React.Fragment key={`${crumb.label}-${idx}`}>
                  {crumb.href && !isLast ? (
                    <Link
                      href={crumb.href}
                      className="transition-colors hover:text-gray-900"
                    >
                      {crumb.label}
                    </Link>
                  ) : (
                    <span className={cn(isLast && 'text-gray-700 font-semibold')}>
                      {crumb.label}
                    </span>
                  )}
                  {!isLast && (
                    <ChevronRight className="h-3.5 w-3.5 text-gray-400" />
                  )}
                </React.Fragment>
              );
            })}
          </nav>
        )}

        {eyebrow && (
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-primary-600">
            {eyebrow}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-bold tracking-tight text-gray-900 sm:text-2xl">
            {title}
          </h1>
          {meta}
        </div>

        {description && (
          <p className="mt-1 max-w-3xl text-sm text-gray-500">{description}</p>
        )}
      </div>

      {(children || (actionLabel && (actionHref || onAction))) && (
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {children}
          {actionLabel && actionHref && (
            <ButtonLink href={actionHref} variant="primary" size="md">
              {actionIcon ?? <Plus className="h-4 w-4" />}
              {actionLabel}
            </ButtonLink>
          )}
          {actionLabel && onAction && !actionHref && (
            <Button onClick={onAction} variant="primary" size="md">
              {actionIcon ?? <Plus className="h-4 w-4" />}
              {actionLabel}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

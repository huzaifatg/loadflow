import React from 'react';
import { cn } from '@/lib/utils';

/* ── Card ────────────────────────────────────────── */
export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hoverable?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const paddingMap = {
  none: 'p-0',
  sm: 'p-3.5',
  md: 'p-5',
  lg: 'p-6',
} as const;

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ hoverable = false, padding, className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'rounded-xl border border-gray-200 bg-white shadow-xs',
        hoverable &&
          'transition-[border-color,box-shadow] duration-150 hover:border-gray-300 hover:shadow-sm',
        padding && paddingMap[padding],
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
);
Card.displayName = 'Card';

/* ── CardHeader ──────────────────────────────────── */
export interface CardHeaderProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  title?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  icon?: React.ReactNode;
  bordered?: boolean;
}

/**
 * Either pass `title`/`description`/`actions` for the standard layout, or
 * children for a custom header.
 */
const CardHeader = React.forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ title, description, actions, icon, bordered = false, className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('flex items-start gap-3 px-5 pt-4 pb-3', bordered && 'border-b border-gray-100 pb-4', className)}
      {...props}
    >
      {children ?? (
        <>
          {icon && (
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-50 text-gray-500 ring-1 ring-inset ring-gray-200 [&_svg]:size-4">
              {icon}
            </div>
          )}
          <div className="min-w-0 flex-1">
            {title && <h2 className="text-[15px] font-semibold leading-6 text-gray-900">{title}</h2>}
            {description && <p className="mt-0.5 text-[13px] leading-5 text-gray-500">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </>
      )}
    </div>
  ),
);
CardHeader.displayName = 'CardHeader';

/* ── CardTitle ───────────────────────────────────── */
const CardTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, children, ...props }, ref) => (
    <h3 ref={ref} className={cn('text-[15px] font-semibold leading-6 text-gray-900', className)} {...props}>
      {children}
    </h3>
  ),
);
CardTitle.displayName = 'CardTitle';

/* ── CardContent ─────────────────────────────────── */
const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn('px-5 py-4', className)} {...props} />,
);
CardContent.displayName = 'CardContent';

/* ── CardFooter ──────────────────────────────────── */
const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('flex items-center gap-2 rounded-b-xl border-t border-gray-100 bg-gray-50/60 px-5 py-3', className)}
      {...props}
    />
  ),
);
CardFooter.displayName = 'CardFooter';

export { Card, CardHeader, CardTitle, CardContent, CardFooter };

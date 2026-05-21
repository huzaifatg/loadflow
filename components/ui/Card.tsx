import React from 'react';
import { cn } from '@/lib/utils';

/* ── Card ────────────────────────────────────────── */
export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hoverable?: boolean;
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ hoverable = false, className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'rounded-xl border border-gray-200 bg-white shadow-sm',
        hoverable &&
          'transition-shadow duration-200 hover:shadow-md hover:border-gray-300',
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
const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('px-6 pt-6 pb-2', className)}
    {...props}
  />
));
CardHeader.displayName = 'CardHeader';

/* ── CardTitle ───────────────────────────────────── */
const CardTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, children, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn(
      'text-base font-semibold text-gray-900 leading-tight',
      className
    )}
    {...props}
  >
    {children}
  </h3>
));
CardTitle.displayName = 'CardTitle';

/* ── CardContent ─────────────────────────────────── */
const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('px-6 py-4', className)} {...props} />
));
CardContent.displayName = 'CardContent';

/* ── CardFooter ──────────────────────────────────── */
const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'px-6 pb-6 pt-2 flex items-center border-t border-gray-100',
      className
    )}
    {...props}
  />
));
CardFooter.displayName = 'CardFooter';

export { Card, CardHeader, CardTitle, CardContent, CardFooter };

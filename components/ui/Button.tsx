// Shared (server + client) component: no hooks, so `buttonClasses` and
// `ButtonLink` can be used directly from server components.
import React from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

const variantStyles = {
  primary:
    'bg-primary-600 text-white shadow-xs hover:bg-primary-700 active:bg-primary-800 border border-primary-700/40',
  secondary:
    'bg-white text-gray-800 border border-gray-200 shadow-xs hover:bg-gray-50 hover:border-gray-300 active:bg-gray-100',
  subtle:
    'bg-primary-50 text-primary-700 border border-primary-100 hover:bg-primary-100 active:bg-primary-200',
  danger:
    'bg-danger-600 text-white shadow-xs hover:bg-danger-700 active:bg-danger-700 border border-danger-700/40',
  'danger-subtle':
    'bg-white text-danger-700 border border-gray-200 shadow-xs hover:bg-danger-50 hover:border-danger-100',
  success:
    'bg-success-600 text-white shadow-xs hover:bg-success-700 border border-success-700/40',
  ghost:
    'bg-transparent text-gray-600 border border-transparent hover:bg-gray-100 hover:text-gray-900 active:bg-gray-200',
} as const;

const sizeStyles = {
  xs: 'h-7 px-2.5 text-xs gap-1.5 rounded-md',
  sm: 'h-8 px-3 text-[13px] gap-1.5 rounded-md',
  md: 'h-9 px-3.5 text-sm gap-2 rounded-lg',
  lg: 'h-10 px-5 text-sm gap-2 rounded-lg',
  icon: 'h-9 w-9 rounded-lg',
  'icon-sm': 'h-8 w-8 rounded-md',
} as const;

export type ButtonVariant = keyof typeof variantStyles;
export type ButtonSize = keyof typeof sizeStyles;

export function buttonClasses(variant: ButtonVariant = 'primary', size: ButtonSize = 'md', className?: string) {
  return cn(
    'inline-flex shrink-0 items-center justify-center whitespace-nowrap font-medium select-none',
    'transition-[background-color,border-color,color,box-shadow] duration-150 ease-out',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500',
    'disabled:opacity-50 disabled:pointer-events-none aria-disabled:opacity-50 aria-disabled:pointer-events-none',
    'cursor-pointer [&_svg]:shrink-0 [&_svg]:size-4',
    variantStyles[variant],
    sizeStyles[size],
    className,
  );
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading = false, disabled, className, children, type = 'button', ...props }, ref) => {
    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        className={buttonClasses(variant, size, className)}
        {...props}
      >
        {loading && <Loader2 className="animate-spin" aria-hidden />}
        {children}
      </button>
    );
  },
);
Button.displayName = 'Button';

export interface ButtonLinkProps extends Omit<React.ComponentProps<typeof Link>, 'className'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}

/** A Next.js Link styled as a Button — avoids nesting <button> in <a>. */
function ButtonLink({ variant = 'primary', size = 'md', className, ...props }: ButtonLinkProps) {
  return <Link className={buttonClasses(variant, size, className)} {...props} />;
}

export { Button, ButtonLink };

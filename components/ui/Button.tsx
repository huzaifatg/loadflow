'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

const variantStyles = {
  primary:
    'bg-primary-600 text-white hover:bg-primary-700 active:bg-primary-800 focus:ring-primary-500 shadow-sm',
  secondary:
    'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 active:bg-gray-100 focus:ring-primary-500 shadow-sm',
  danger:
    'bg-danger-600 text-white hover:bg-danger-700 active:bg-danger-700 focus:ring-danger-500 shadow-sm',
  ghost:
    'bg-transparent text-gray-600 hover:bg-gray-100 active:bg-gray-200 focus:ring-primary-500',
} as const;

const sizeStyles = {
  sm: 'h-8 px-3 text-xs gap-1.5 rounded-lg',
  md: 'h-9 px-4 text-sm gap-2 rounded-lg',
  lg: 'h-11 px-6 text-sm gap-2 rounded-xl',
} as const;

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variantStyles;
  size?: keyof typeof sizeStyles;
  loading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      disabled,
      className,
      children,
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || loading;

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        className={cn(
          'inline-flex items-center justify-center font-medium transition-all duration-150 ease-in-out',
          'focus:outline-none focus:ring-2 focus:ring-offset-2',
          'disabled:opacity-50 disabled:pointer-events-none',
          'cursor-pointer',
          variantStyles[variant],
          sizeStyles[size],
          className
        )}
        {...props}
      >
        {loading && (
          <Loader2 className="h-4 w-4 animate-spin shrink-0" />
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';

export { Button };

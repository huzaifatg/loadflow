import React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="mb-1.5 block text-sm font-medium text-gray-700"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            'block w-full rounded-lg border bg-white px-3.5 py-2 text-sm text-gray-900 placeholder:text-gray-400',
            'transition-colors duration-150',
            'focus:outline-none focus:ring-2 focus:ring-offset-0',
            error
              ? 'border-danger-500 focus:ring-danger-500/30'
              : 'border-gray-300 focus:border-primary-500 focus:ring-primary-500/30',
            'disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500',
            className
          )}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${inputId}-error` : undefined}
          {...props}
        />
        {error && (
          <p
            id={`${inputId}-error`}
            className="mt-1.5 text-xs text-danger-600"
          >
            {error}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export { Input };

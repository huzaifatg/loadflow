import React from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: SelectOption[];
  placeholder?: string;
}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  (
    { label, error, options, placeholder, className, id, ...props },
    ref
  ) => {
    const selectId =
      id ?? label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={selectId}
            className="mb-1.5 block text-sm font-medium text-gray-700"
          >
            {label}
          </label>
        )}
        <div className="relative">
          <select
            ref={ref}
            id={selectId}
            className={cn(
              'block w-full appearance-none rounded-lg border bg-white px-3.5 py-2 pr-10 text-sm text-gray-900',
              'transition-colors duration-150',
              'focus:outline-none focus:ring-2 focus:ring-offset-0',
              error
                ? 'border-danger-500 focus:ring-danger-500/30'
                : 'border-gray-300 focus:border-primary-500 focus:ring-primary-500/30',
              'disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500',
              className
            )}
            aria-invalid={error ? true : undefined}
            aria-describedby={
              error ? `${selectId}-error` : undefined
            }
            {...props}
          >
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        </div>
        {error && (
          <p
            id={`${selectId}-error`}
            className="mt-1.5 text-xs text-danger-600"
          >
            {error}
          </p>
        )}
      </div>
    );
  }
);

Select.displayName = 'Select';

export { Select };

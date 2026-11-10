import React from 'react';
import { cn } from '@/lib/utils';

/* Shared field chrome for Input / Select / Textarea */
export const fieldBase = cn(
  'block w-full rounded-lg border bg-white text-sm text-gray-900 placeholder:text-gray-400 shadow-xs',
  'transition-[border-color,box-shadow] duration-150',
  'focus:outline-none focus-visible:outline-none focus:ring-[3px]',
  'disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500',
);

export function fieldState(error?: string) {
  return error
    ? 'border-danger-500 focus:border-danger-500 focus:ring-danger-500/15'
    : 'border-gray-200 hover:border-gray-300 focus:border-primary-500 focus:ring-primary-500/15';
}

export function slugId(label?: string) {
  return label?.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export interface FieldShellProps {
  id?: string;
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}

/** Label + control + hint/error, with correct aria wiring. */
export function FieldShell({ id, label, hint, error, required, children }: FieldShellProps) {
  return (
    <div className="w-full">
      {label && (
        <label htmlFor={id} className="mb-1.5 block text-[13px] font-medium text-gray-700">
          {label}
          {required && (
            <span className="ml-0.5 text-danger-600" aria-hidden>
              *
            </span>
          )}
        </label>
      )}
      {children}
      {error ? (
        <p id={id ? `${id}-error` : undefined} role="alert" className="mt-1.5 text-xs text-danger-600">
          {error}
        </p>
      ) : hint ? (
        <p id={id ? `${id}-hint` : undefined} className="mt-1.5 text-xs text-gray-500">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function describedBy(id: string | undefined, error?: string, hint?: string) {
  if (!id) return undefined;
  if (error) return `${id}-error`;
  if (hint) return `${id}-hint`;
  return undefined;
}

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  leadingIcon?: React.ReactNode;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, leadingIcon, className, id, required, ...props }, ref) => {
    const inputId = id ?? slugId(label);
    return (
      <FieldShell id={inputId} label={label} hint={hint} error={error} required={required}>
        <div className="relative">
          {leadingIcon && (
            <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400 [&_svg]:size-4">
              {leadingIcon}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            required={required}
            className={cn(fieldBase, fieldState(error), 'h-9 px-3', leadingIcon && 'pl-9', className)}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy(inputId, error, hint)}
            {...props}
          />
        </div>
      </FieldShell>
    );
  },
);

Input.displayName = 'Input';

export { Input };

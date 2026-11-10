import React from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown } from 'lucide-react';
import { FieldShell, fieldBase, fieldState, slugId, describedBy } from '@/components/ui/Input';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  hint?: string;
  options: SelectOption[];
  placeholder?: string;
}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, hint, options, placeholder, className, id, required, ...props }, ref) => {
    const selectId = id ?? slugId(label);
    return (
      <FieldShell id={selectId} label={label} hint={hint} error={error} required={required}>
        <div className="relative">
          <select
            ref={ref}
            id={selectId}
            required={required}
            className={cn(fieldBase, fieldState(error), 'h-9 appearance-none pl-3 pr-9', className)}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy(selectId, error, hint)}
            {...props}
          >
            {placeholder && (
              <option value="" disabled={required}>
                {placeholder}
              </option>
            )}
            {options.map((opt) => (
              <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                {opt.label}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden />
        </div>
      </FieldShell>
    );
  },
);

Select.displayName = 'Select';

export { Select };

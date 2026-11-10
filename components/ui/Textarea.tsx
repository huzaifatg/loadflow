import React from 'react';
import { cn } from '@/lib/utils';
import { FieldShell, fieldBase, fieldState, slugId, describedBy } from '@/components/ui/Input';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, hint, className, id, rows = 4, required, ...props }, ref) => {
    const textareaId = id ?? slugId(label);
    return (
      <FieldShell id={textareaId} label={label} hint={hint} error={error} required={required}>
        <textarea
          ref={ref}
          id={textareaId}
          rows={rows}
          required={required}
          className={cn(fieldBase, fieldState(error), 'resize-y px-3 py-2', className)}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(textareaId, error, hint)}
          {...props}
        />
      </FieldShell>
    );
  },
);

Textarea.displayName = 'Textarea';

export { Textarea };

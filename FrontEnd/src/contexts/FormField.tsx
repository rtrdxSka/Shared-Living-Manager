import type { FieldError } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import React from 'react';

interface FormFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: FieldError;
}

const FormField = React.forwardRef<HTMLInputElement, FormFieldProps>(
  ({ label, error, className, id, ...props }, ref) => {
    const fieldId = id || props.name;

    return (
      <div className="space-y-2">
        <Label htmlFor={fieldId}>{label}</Label>
        <Input
          id={fieldId}
          ref={ref}
          className={cn(error && 'border-destructive', className)}
          {...props}
        />
        {error && (
          <p className="text-sm text-destructive">{error.message}</p>
        )}
      </div>
    );
  }
);
FormField.displayName = 'FormField';

export { FormField };
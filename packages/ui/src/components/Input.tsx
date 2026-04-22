import { forwardRef, InputHTMLAttributes } from 'react';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className = '', error = false, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={`
          w-full px-3 py-2 rounded border text-[var(--text-base)] placeholder-[var(--color-text-tertiary)]
          bg-[var(--color-background-primary)]
          border-[var(--color-border-default)]
          focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-primary)] focus:border-transparent
          disabled:opacity-50 disabled:cursor-not-allowed
          ${error ? 'border-[var(--color-semantic-error)]' : ''}
          ${className}
        `}
        {...props}
      />
    );
  }
);

Input.displayName = 'Input';
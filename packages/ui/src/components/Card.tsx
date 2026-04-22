import { HTMLAttributes, forwardRef } from 'react';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'bordered' | 'elevated';
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className = '', variant = 'default', children, ...props }, ref) => {
    const baseStyles = 'rounded-lg overflow-hidden';

    const variants = {
      default: 'bg-[var(--color-background-primary)]',
      bordered: 'bg-[var(--color-background-primary)] border border-[var(--color-border-default)]',
      elevated: 'bg-[var(--color-background-primary)] shadow-[var(--shadow-md)]',
    };

    return (
      <div
        ref={ref}
        className={`${baseStyles} ${variants[variant]} ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';
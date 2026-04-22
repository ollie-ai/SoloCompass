import React from 'react';

export interface LabelProps {
  /** Label text content */
  children: React.ReactNode;
  /** Optional HTML for attribute */
  htmlFor?: string;
  /** Additional CSS classes */
  className?: string;
  /** Whether the label is required (adds asterisk) */
  required?: boolean;
  /** Disable the label */
  disabled?: boolean;
}

/**
 * Form label component
 */
export function Label({
  children,
  htmlFor,
  className = '',
  required = false,
  disabled = false,
}: LabelProps) {
  return (
    <label
      htmlFor={htmlFor}
      className={`label ${className}`.trim()}
      style={{
        display: 'block',
        fontSize: '0.875rem',
        fontWeight: 500,
        color: disabled ? '#9ca3af' : '#374151',
        marginBottom: '0.25rem',
      }}
    >
      {children}
      {required && (
        <span style={{ color: '#ef4444', marginLeft: '0.25rem' }}>*</span>
      )}
    </label>
  );
}
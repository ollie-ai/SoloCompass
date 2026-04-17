import { forwardRef, memo } from 'react';
import PropTypes from 'prop-types';

const sizes = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-3 text-base',
  lg: 'px-5 py-4 text-lg',
};

const Select = forwardRef(({
  label,
  value,
  onChange,
  options = [],
  error,
  helperText,
  disabled = false,
  required = false,
  size = 'md',
  className = '',
  placeholder,
  id,
  name,
  ...props
}, ref) => {
  const selectId = id || name;

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={selectId} className="block text-sm font-medium text-base-content/80 mb-1.5">
          {label}
          {required && <span className="text-error ml-1" aria-hidden="true">*</span>}
        </label>
      )}
      <select
        ref={ref}
        id={selectId}
        name={name}
        value={value}
        onChange={onChange}
        disabled={disabled}
        required={required}
        aria-invalid={!!error}
        aria-describedby={
          error ? `${selectId}-error` : helperText ? `${selectId}-helper` : undefined
        }
        aria-required={required || undefined}
        className={`
          w-full border-2 rounded-xl text-base-content bg-base-100/80 backdrop-blur-sm
          focus:outline-none focus:ring-4 focus:ring-primary/20 focus:border-primary
          disabled:bg-base-200 disabled:cursor-not-allowed
          transition-all duration-200 appearance-none
          ${error ? 'border-error focus:ring-error/20 focus:border-error' : 'border-base-300 hover:border-base-300/70'}
          ${sizes[size]}
          ${className}
        `}
        {...props}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} disabled={opt.disabled}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && (
        <p id={`${selectId}-error`} className="mt-1.5 text-sm text-error" role="alert">
          {error}
        </p>
      )}
      {!error && helperText && (
        <p id={`${selectId}-helper`} className="mt-1.5 text-sm text-base-content/60">
          {helperText}
        </p>
      )}
    </div>
  );
});

Select.displayName = 'Select';

Select.propTypes = {
  label: PropTypes.string,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onChange: PropTypes.func,
  options: PropTypes.arrayOf(
    PropTypes.shape({
      value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
      label: PropTypes.string.isRequired,
      disabled: PropTypes.bool,
    })
  ),
  error: PropTypes.string,
  helperText: PropTypes.string,
  disabled: PropTypes.bool,
  required: PropTypes.bool,
  size: PropTypes.oneOf(['sm', 'md', 'lg']),
  className: PropTypes.string,
  placeholder: PropTypes.string,
  id: PropTypes.string,
  name: PropTypes.string,
};

export default memo(Select);

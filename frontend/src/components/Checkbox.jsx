import { forwardRef, memo, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';

const Checkbox = forwardRef(({
  label,
  checked,
  onChange,
  disabled = false,
  error,
  helperText,
  indeterminate = false,
  className = '',
  id,
  name,
  ...props
}, ref) => {
  const internalRef = useRef(null);
  const checkboxRef = ref || internalRef;
  const checkboxId = id || name;

  useEffect(() => {
    if (checkboxRef.current) {
      checkboxRef.current.indeterminate = indeterminate;
    }
  }, [indeterminate, checkboxRef]);

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <label
        className={`flex items-center gap-3 cursor-pointer group ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
      >
        <input
          ref={checkboxRef}
          type="checkbox"
          id={checkboxId}
          name={name}
          checked={checked}
          onChange={onChange}
          disabled={disabled}
          aria-invalid={!!error}
          aria-describedby={
            error ? `${checkboxId}-error` : helperText ? `${checkboxId}-helper` : undefined
          }
          className={`
            w-5 h-5 rounded border-2 border-base-300 bg-base-100
            checked:bg-primary checked:border-primary
            focus:outline-none focus:ring-4 focus:ring-primary/20
            disabled:cursor-not-allowed
            transition-all duration-200
            ${error ? 'border-error' : ''}
          `}
          {...props}
        />
        {label && (
          <span className="text-sm font-medium text-base-content/80 select-none">
            {label}
          </span>
        )}
      </label>
      {error && (
        <p id={`${checkboxId}-error`} className="text-sm text-error" role="alert">
          {error}
        </p>
      )}
      {!error && helperText && (
        <p id={`${checkboxId}-helper`} className="text-sm text-base-content/60">
          {helperText}
        </p>
      )}
    </div>
  );
});

Checkbox.displayName = 'Checkbox';

Checkbox.propTypes = {
  label: PropTypes.string,
  checked: PropTypes.bool,
  onChange: PropTypes.func,
  disabled: PropTypes.bool,
  error: PropTypes.string,
  helperText: PropTypes.string,
  indeterminate: PropTypes.bool,
  className: PropTypes.string,
  id: PropTypes.string,
  name: PropTypes.string,
};

export default memo(Checkbox);

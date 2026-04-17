import { memo } from 'react';
import PropTypes from 'prop-types';

const trackSizes = {
  sm: 'w-8 h-4',
  md: 'w-11 h-6',
  lg: 'w-14 h-7',
};

const thumbSizes = {
  sm: 'w-3 h-3',
  md: 'w-4 h-4',
  lg: 'w-5 h-5',
};

const thumbTranslate = {
  sm: 'translate-x-4',
  md: 'translate-x-5',
  lg: 'translate-x-7',
};

const Toggle = ({
  label,
  checked = false,
  onChange,
  disabled = false,
  size = 'md',
  className = '',
  id,
  name,
  ...props
}) => {
  const toggleId = id || name;

  return (
    <label
      htmlFor={toggleId}
      className={`inline-flex items-center gap-3 cursor-pointer group ${disabled ? 'cursor-not-allowed opacity-60' : ''} ${className}`}
    >
      <div className="relative flex items-center">
        <input
          type="checkbox"
          role="switch"
          id={toggleId}
          name={name}
          checked={checked}
          onChange={onChange}
          disabled={disabled}
          aria-checked={checked}
          className="sr-only peer"
          {...props}
        />
        <div
          className={`
            ${trackSizes[size]} rounded-full transition-colors duration-200
            bg-base-300 peer-checked:bg-primary
            peer-focus:ring-4 peer-focus:ring-primary/20
            peer-disabled:opacity-60 peer-disabled:cursor-not-allowed
          `}
        />
        <div
          className={`
            ${thumbSizes[size]} absolute left-1
            rounded-full bg-white shadow-sm
            transition-transform duration-200
            ${checked ? thumbTranslate[size] : 'translate-x-0'}
          `}
        />
      </div>
      {label && (
        <span className="text-sm font-medium text-base-content/80 select-none">
          {label}
        </span>
      )}
    </label>
  );
};

Toggle.propTypes = {
  label: PropTypes.string,
  checked: PropTypes.bool,
  onChange: PropTypes.func,
  disabled: PropTypes.bool,
  size: PropTypes.oneOf(['sm', 'md', 'lg']),
  className: PropTypes.string,
  id: PropTypes.string,
  name: PropTypes.string,
};

export default memo(Toggle);

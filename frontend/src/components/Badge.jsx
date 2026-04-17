/**
 * Badge / Tag — standalone component
 * Replaces ad-hoc inline DaisyUI `.badge` patterns across the app.
 */
import PropTypes from 'prop-types';

const VARIANT_MAP = {
  primary:  'bg-primary/10  text-primary  border border-primary/20',
  success:  'bg-success/10  text-success  border border-success/20',
  warning:  'bg-warning/10  text-warning  border border-warning/20',
  error:    'bg-error/10    text-error    border border-error/20',
  info:     'bg-info/10     text-info     border border-info/20',
  neutral:  'bg-base-200   text-base-content border border-base-300',
  accent:   'bg-accent/10  text-accent   border border-accent/20',
};

const SIZE_MAP = {
  sm: 'px-1.5 py-0.5 text-[10px] leading-4',
  md: 'px-2.5 py-1   text-xs      leading-4',
  lg: 'px-3   py-1.5 text-sm      leading-5',
};

export default function Badge({
  children,
  variant = 'neutral',
  size = 'md',
  dot = false,
  icon: Icon,
  className = '',
}) {
  const variantClass = VARIANT_MAP[variant] ?? VARIANT_MAP.neutral;
  const sizeClass = SIZE_MAP[size] ?? SIZE_MAP.md;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-bold tracking-wide ${variantClass} ${sizeClass} ${className}`}
    >
      {dot && (
        <span
          className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
            variant === 'neutral' ? 'bg-base-content/40' : `bg-current opacity-70`
          }`}
          aria-hidden="true"
        />
      )}
      {Icon && <Icon size={12} aria-hidden="true" />}
      {children}
    </span>
  );
}

Badge.propTypes = {
  children: PropTypes.node.isRequired,
  /** Colour variant */
  variant: PropTypes.oneOf(['primary', 'success', 'warning', 'error', 'info', 'neutral', 'accent']),
  /** Size */
  size: PropTypes.oneOf(['sm', 'md', 'lg']),
  /** Show a leading dot indicator */
  dot: PropTypes.bool,
  /** Optional Lucide icon component */
  icon: PropTypes.elementType,
  className: PropTypes.string,
};

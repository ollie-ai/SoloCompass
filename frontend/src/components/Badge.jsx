import PropTypes from 'prop-types';

const variants = {
  default:  'bg-base-200 text-base-content/80 border border-base-300',
  primary:  'bg-primary/10 text-primary border border-primary/20',
  success:  'bg-success/10 text-success border border-success/20',
  warning:  'bg-warning/10 text-warning border border-warning/20',
  error:    'bg-error/10 text-error border border-error/20',
  info:     'bg-info/10 text-info border border-info/20',
  accent:   'bg-accent/10 text-accent border border-accent/20',
  outline:  'bg-transparent border border-base-content/30 text-base-content/70',
};

const sizes = {
  sm: 'px-1.5 py-0.5 text-[10px]',
  md: 'px-2.5 py-0.5 text-xs',
  lg: 'px-3 py-1 text-sm',
};

/**
 * Badge — inline label for statuses, tags, and counts.
 *
 * @example
 * <Badge variant="success">Active</Badge>
 * <Badge variant="warning" size="sm">Beta</Badge>
 * <Badge variant="error" dot>Alert</Badge>
 */
const Badge = ({
  children,
  variant = 'default',
  size = 'md',
  dot = false,
  className = '',
  ...props
}) => {
  const variantClasses = variants[variant] || variants.default;
  const sizeClasses    = sizes[size]    || sizes.md;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-bold ${sizeClasses} ${variantClasses} ${className}`}
      {...props}
    >
      {dot && (
        <span
          className="w-1.5 h-1.5 rounded-full bg-current opacity-80 flex-shrink-0"
          aria-hidden="true"
        />
      )}
      {children}
    </span>
  );
};

Badge.propTypes = {
  children:  PropTypes.node.isRequired,
  variant:   PropTypes.oneOf(Object.keys(variants)),
  size:      PropTypes.oneOf(Object.keys(sizes)),
  dot:       PropTypes.bool,
  className: PropTypes.string,
};

export default Badge;

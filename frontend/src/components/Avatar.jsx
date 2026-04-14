import PropTypes from 'prop-types';
import { User } from 'lucide-react';

const sizes = {
  xs:  { wrapper: 'w-6 h-6',   text: 'text-[10px]', icon: 12, ring: 'ring-1' },
  sm:  { wrapper: 'w-8 h-8',   text: 'text-xs',     icon: 14, ring: 'ring-1' },
  md:  { wrapper: 'w-10 h-10', text: 'text-sm',     icon: 18, ring: 'ring-2' },
  lg:  { wrapper: 'w-14 h-14', text: 'text-base',   icon: 24, ring: 'ring-2' },
  xl:  { wrapper: 'w-20 h-20', text: 'text-xl',     icon: 32, ring: 'ring-2' },
};

const statusColors = {
  online:  'bg-success',
  away:    'bg-warning',
  busy:    'bg-error',
  offline: 'bg-base-300',
};

/**
 * Avatar — user or entity profile image with fallback initials / icon.
 *
 * @example
 * <Avatar src={user.avatar} name="Jane Doe" size="md" status="online" />
 * <Avatar name="SC" variant="square" />
 */
const Avatar = ({
  src,
  name,
  size = 'md',
  variant = 'circle',
  status,
  ring = false,
  ringColor = 'ring-primary',
  className = '',
  alt,
  ...props
}) => {
  const s = sizes[size] || sizes.md;
  const shape = variant === 'square' ? 'rounded-xl' : 'rounded-full';

  const initials = name
    ? name
        .split(' ')
        .slice(0, 2)
        .map(w => w[0]?.toUpperCase())
        .join('')
    : null;

  return (
    <div
      className={`relative inline-flex flex-shrink-0 ${s.wrapper} ${shape} ${ring ? `${s.ring} ${ringColor}` : ''} ${className}`}
      aria-label={alt || name || 'Avatar'}
      {...props}
    >
      {src ? (
        <img
          src={src}
          alt={alt || name || 'User avatar'}
          className={`${s.wrapper} ${shape} object-cover`}
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
        />
      ) : initials ? (
        <div
          className={`${s.wrapper} ${shape} flex items-center justify-center bg-primary/10 text-primary font-bold ${s.text} select-none`}
          aria-hidden="true"
        >
          {initials}
        </div>
      ) : (
        <div
          className={`${s.wrapper} ${shape} flex items-center justify-center bg-base-200 text-base-content/40`}
          aria-hidden="true"
        >
          <User size={s.icon} />
        </div>
      )}

      {status && (
        <span
          className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-base-100 ${statusColors[status] || statusColors.offline}`}
          aria-label={`Status: ${status}`}
        />
      )}
    </div>
  );
};

Avatar.propTypes = {
  src:       PropTypes.string,
  name:      PropTypes.string,
  size:      PropTypes.oneOf(Object.keys(sizes)),
  variant:   PropTypes.oneOf(['circle', 'square']),
  status:    PropTypes.oneOf(Object.keys(statusColors)),
  ring:      PropTypes.bool,
  ringColor: PropTypes.string,
  className: PropTypes.string,
  alt:       PropTypes.string,
};

export default Avatar;

/**
 * Avatar — standalone component
 * Renders a user avatar with image (when `src` is supplied) or initials fallback.
 * Supports multiple sizes and an optional `ring` highlight.
 */
import PropTypes from 'prop-types';

const SIZE_MAP = {
  xs: 'w-6 h-6 text-[9px]',
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-14 h-14 text-base',
  xl: 'w-20 h-20 text-xl',
};

function getInitials(name) {
  if (!name) return '?';
  return name
    .trim()
    .split(/\s+/)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .substring(0, 2);
}

export default function Avatar({ src, name, alt, size = 'md', ring = false, className = '' }) {
  const sizeClass = SIZE_MAP[size] ?? SIZE_MAP.md;
  const ringClass = ring ? 'ring-2 ring-primary ring-offset-1' : '';
  const baseClass = `rounded-full flex items-center justify-center shrink-0 overflow-hidden ${sizeClass} ${ringClass} ${className}`;

  if (src) {
    return (
      <img
        src={src}
        alt={alt ?? (name ? `${name}'s avatar` : 'User avatar')}
        className={`${baseClass} object-cover bg-base-300`}
        onError={(e) => {
          // Fall back gracefully if image fails to load
          e.currentTarget.style.display = 'none';
          e.currentTarget.nextElementSibling?.classList?.remove('hidden');
        }}
      />
    );
  }

  return (
    <div
      className={`${baseClass} bg-gradient-to-br from-primary to-secondary`}
      aria-label={name ? `${name}'s avatar` : 'User avatar'}
      role="img"
    >
      <span className="font-black text-white leading-none">{getInitials(name)}</span>
    </div>
  );
}

Avatar.propTypes = {
  /** Image URL — renders an <img> when supplied */
  src: PropTypes.string,
  /** Display name — used for initials fallback and accessible alt text */
  name: PropTypes.string,
  /** Override alt text for the image variant */
  alt: PropTypes.string,
  /** xs | sm | md (default) | lg | xl */
  size: PropTypes.oneOf(['xs', 'sm', 'md', 'lg', 'xl']),
  /** Show a primary-colour ring around the avatar */
  ring: PropTypes.bool,
  className: PropTypes.string,
};

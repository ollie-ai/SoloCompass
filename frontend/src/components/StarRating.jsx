import { Star } from 'lucide-react';

function StarRating({ 
  value = 0, 
  onChange, 
  max = 5, 
  size = 'md',
  readOnly = false,
  showValue = false,
  className = '' 
}) {
  const sizes = { sm: 'w-3 h-3', md: 'w-5 h-5', lg: 'w-6 h-6' };
  const iconSize = sizes[size] || sizes.md;

  return (
    <div className={`flex items-center gap-0.5 ${className}`}>
      {Array.from({ length: max }, (_, i) => i + 1).map((star) => (
        <button
          key={star}
          type="button"
          disabled={readOnly}
          onClick={() => !readOnly && onChange && onChange(star)}
          className={`${readOnly ? 'cursor-default' : 'cursor-pointer hover:scale-110'} transition-transform`}
          aria-label={`${star} star${star !== 1 ? 's' : ''}`}
        >
          <Star
            className={`${iconSize} ${
              star <= value
                ? 'fill-yellow-400 text-yellow-400'
                : 'fill-transparent text-gray-300'
            }`}
          />
        </button>
      ))}
      {showValue && (
        <span className="ml-1 text-sm text-gray-600 dark:text-gray-400">
          {value > 0 ? value.toFixed(1) : '—'}
        </span>
      )}
    </div>
  );
}

export default StarRating;

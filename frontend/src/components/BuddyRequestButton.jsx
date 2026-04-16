import PropTypes from 'prop-types';
import { MessageCircle, Loader2 } from 'lucide-react';

/**
 * BuddyRequestButton – compact single-action button to send a buddy connection request.
 * Shows a spinner while the request is in-flight.
 */
function BuddyRequestButton({ userId, onConnect, loading, disabled, className = '' }) {
  return (
    <button
      onClick={() => onConnect?.(userId)}
      disabled={loading || disabled}
      className={`inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl font-bold text-xs bg-brand-vibrant text-white shadow-sm shadow-brand-vibrant/20 hover:bg-emerald-600 transition-colors disabled:opacity-50 ${className}`}
    >
      {loading ? (
        <Loader2 size={12} className="animate-spin" />
      ) : (
        <MessageCircle size={12} />
      )}
      Connect
    </button>
  );
}

BuddyRequestButton.propTypes = {
  userId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onConnect: PropTypes.func,
  loading: PropTypes.bool,
  disabled: PropTypes.bool,
  className: PropTypes.string,
};

export default BuddyRequestButton;

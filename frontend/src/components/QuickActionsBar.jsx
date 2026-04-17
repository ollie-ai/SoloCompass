import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Sparkles, Plus } from 'lucide-react';

const ACTIONS = [
  {
    key: 'sos',
    label: 'SOS',
    icon: AlertTriangle,
    className: 'bg-error text-white border-error hover:bg-error/90',
  },
  {
    key: 'checkin',
    label: 'Check-In',
    icon: CheckCircle2,
    className: 'bg-success/10 text-success border-success/30 hover:bg-success/20',
  },
  {
    key: 'atlas',
    label: 'Atlas',
    icon: Sparkles,
    className: 'bg-brand-vibrant/10 text-brand-vibrant border-brand-vibrant/30 hover:bg-brand-vibrant/20',
  },
  {
    key: 'new-trip',
    label: 'New Trip',
    icon: Plus,
    className: 'bg-base-200 text-base-content border-base-300 hover:bg-base-300',
    href: '/trips/new',
  },
];

/**
 * QuickActionsBar — four-action shortcut bar for SOS, check-in, Atlas, and new trip.
 *
 * Props:
 *  onSOS      — () => void   (opens SOS / emergency panel)
 *  onCheckIn  — () => void   (opens safety check-in)
 *  onAtlas    — () => void   (opens Atlas AI chat; if omitted a "atlas:open" CustomEvent is dispatched)
 *  className  — extra wrapper classes
 */
export default function QuickActionsBar({ onSOS, onCheckIn, onAtlas, className = '' }) {
  const CALLBACKS = {
    sos: onSOS,
    checkin: onCheckIn,
    atlas: onAtlas ?? (() => window.dispatchEvent(new CustomEvent('atlas:open'))),
  };

  const handleClick = (key) => CALLBACKS[key]?.();

  return (
    <div className={`flex items-center gap-3 flex-wrap ${className}`} role="toolbar" aria-label="Quick actions">
      {ACTIONS.map(({ key, label, icon: Icon, className: cls, href }) => {
        if (href) {
          return (
            <Link
              key={key}
              to={href}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm border transition-all shadow-sm ${cls}`}
            >
              <Icon size={16} aria-hidden="true" />
              {label}
            </Link>
          );
        }
        return (
          <button
            key={key}
            type="button"
            onClick={() => handleClick(key)}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm border transition-all shadow-sm ${cls}`}
          >
            <Icon size={16} aria-hidden="true" />
            {label}
          </button>
        );
      })}
    </div>
  );
}

import PropTypes from 'prop-types';
import { Info, ThumbsUp, ThumbsDown, AlertTriangle, Heart } from 'lucide-react';

const NORM_ICONS = {
  do:      { Icon: ThumbsUp,      color: 'text-success', bg: 'bg-success/10', border: 'border-success/20',  label: 'Do' },
  dont:    { Icon: ThumbsDown,    color: 'text-error',   bg: 'bg-error/10',   border: 'border-error/20',    label: "Don't" },
  warning: { Icon: AlertTriangle, color: 'text-warning', bg: 'bg-warning/10', border: 'border-warning/20',  label: 'Warning' },
  custom:  { Icon: Info,          color: 'text-info',    bg: 'bg-info/10',    border: 'border-info/20',     label: 'Note' },
  tip:     { Icon: Heart,         color: 'text-accent',  bg: 'bg-accent/10',  border: 'border-accent/20',   label: 'Local Tip' },
};

/**
 * CulturalNormsCard — displays a set of cultural do/don't/tip items for a destination.
 *
 * @example
 * <CulturalNormsCard
 *   destination="Japan"
 *   norms={[
 *     { type: 'do',      text: 'Remove shoes before entering a home' },
 *     { type: 'dont',    text: 'Tip at restaurants — it can be considered rude' },
 *     { type: 'warning', text: 'Avoid pointing at people with chopsticks' },
 *     { type: 'tip',     text: 'Bow slightly when greeting — depth signals respect' },
 *   ]}
 * />
 */
const CulturalNormsCard = ({
  destination = '',
  norms = [],
  className = '',
}) => {
  if (!norms.length) return null;

  // Group by type so we can render do/don't/tips in sections if preferred
  const grouped = norms.reduce((acc, norm) => {
    const t = norm.type || 'custom';
    if (!acc[t]) acc[t] = [];
    acc[t].push(norm);
    return acc;
  }, {});

  const typeOrder = ['do', 'dont', 'warning', 'tip', 'custom'];
  const orderedKeys = typeOrder.filter(t => grouped[t]?.length);

  return (
    <div
      className={`rounded-2xl border border-base-200 bg-base-100 overflow-hidden ${className}`}
      aria-label={`Cultural norms for ${destination || 'this destination'}`}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-base-200 flex items-center gap-2">
        <Info size={15} className="text-primary" aria-hidden="true" />
        <p className="font-black text-sm text-base-content">
          Cultural Norms{destination ? ` — ${destination}` : ''}
        </p>
      </div>

      {/* Norm items */}
      <div className="divide-y divide-base-200">
        {orderedKeys.map(type => {
          const { Icon, color, bg, border, label } = NORM_ICONS[type] || NORM_ICONS.custom;
          return (
            <div key={type} className="p-4 space-y-2">
              <p className={`text-[10px] uppercase tracking-widest font-black ${color} opacity-70`}>
                {label}
              </p>
              <ul className="space-y-1.5">
                {grouped[type].map((norm, idx) => (
                  <li
                    key={idx}
                    className={`flex items-start gap-2.5 rounded-xl p-2.5 ${bg} border ${border}`}
                  >
                    <Icon size={14} className={`flex-shrink-0 mt-0.5 ${color}`} aria-hidden="true" />
                    <span className="text-xs text-base-content/80 leading-snug">{norm.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
};

CulturalNormsCard.propTypes = {
  destination: PropTypes.string,
  norms: PropTypes.arrayOf(
    PropTypes.shape({
      type: PropTypes.oneOf(['do', 'dont', 'warning', 'tip', 'custom']),
      text: PropTypes.string.isRequired,
    })
  ),
  className: PropTypes.string,
};

export default CulturalNormsCard;

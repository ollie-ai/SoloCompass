import { AlertTriangle, CheckCircle } from 'lucide-react';
import PropTypes from 'prop-types';

export function UsageMeter({ label, used, limit, unit = '', className = '' }) {
  if (limit === null || limit === undefined) {
    return (
      <div className={`flex items-center justify-between py-1.5 ${className}`}>
        <span className="text-xs font-semibold text-base-content/70">{label}</span>
        <span className="text-xs font-bold text-brand-vibrant flex items-center gap-1">
          <CheckCircle size={11} /> Unlimited
        </span>
      </div>
    );
  }

  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const nearLimit = pct >= 80;
  const atLimit = pct >= 100;

  return (
    <div className={`space-y-1.5 ${className}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-base-content/70">{label}</span>
        <span
          className={`text-xs font-bold flex items-center gap-1 ${
            atLimit ? 'text-error' : nearLimit ? 'text-warning' : 'text-base-content/60'
          }`}
        >
          {used}{unit} / {limit}{unit}
          {atLimit && <AlertTriangle size={11} />}
        </span>
      </div>
      <div className="w-full h-1.5 bg-base-200 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${
            atLimit ? 'bg-error' : nearLimit ? 'bg-warning' : 'bg-brand-vibrant'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

UsageMeter.propTypes = {
  label: PropTypes.string.isRequired,
  used: PropTypes.number,
  limit: PropTypes.number,
  unit: PropTypes.string,
  className: PropTypes.string,
};

export default UsageMeter;

import { useEffect, useState } from 'react';
import { CheckCircle2, Circle, ChevronRight, Loader } from 'lucide-react';
import api from '../lib/api';

/**
 * ProfileCompletenessCard — shows the user's own profile completeness score.
 * Fetches from GET /api/users/me/completeness.
 *
 * Props:
 *   onNavigate(field) — optional callback when user clicks a missing field action
 */
export default function ProfileCompletenessCard({ onNavigate }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/users/me/completeness')
      .then(res => setData(res.data.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader className="w-5 h-5 animate-spin text-brand-vibrant" />
      </div>
    );
  }

  if (!data) return null;

  const { percentage, label, steps } = data;

  const barColor =
    percentage >= 90 ? 'bg-brand-vibrant' :
    percentage >= 60 ? 'bg-amber-400' :
    'bg-red-400';

  return (
    <div className="space-y-4">
      {/* Score header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-bold text-base-content">{label}</p>
          <p className="text-xs text-base-content/50">{percentage}% complete</p>
        </div>
        <span className={`text-2xl font-black ${percentage >= 90 ? 'text-brand-vibrant' : percentage >= 60 ? 'text-amber-500' : 'text-red-500'}`}>
          {percentage}%
        </span>
      </div>

      {/* Progress bar */}
      <div className="w-full h-2 bg-base-200 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${barColor}`}
          style={{ width: `${percentage}%` }}
        />
      </div>

      {/* Steps checklist */}
      <ul className="space-y-2">
        {steps.map(step => (
          <li key={step.field} className="flex items-center gap-2 text-sm">
            {step.complete
              ? <CheckCircle2 className="w-4 h-4 text-brand-vibrant flex-shrink-0" />
              : <Circle className="w-4 h-4 text-base-content/30 flex-shrink-0" />
            }
            <span className={step.complete ? 'text-base-content/60 line-through' : 'text-base-content'}>
              {step.label}
            </span>
            <span className="text-xs text-base-content/30 ml-auto">+{step.weight}%</span>
            {!step.complete && onNavigate && (
              <button
                type="button"
                onClick={() => onNavigate(step.field)}
                className="ml-1 text-brand-vibrant hover:underline text-xs flex items-center gap-0.5"
              >
                Add <ChevronRight className="w-3 h-3" />
              </button>
            )}
          </li>
        ))}
      </ul>

      {percentage < 100 && (
        <p className="text-xs text-base-content/40 italic">
          Complete your profile to improve buddy match accuracy.
        </p>
      )}
    </div>
  );
}

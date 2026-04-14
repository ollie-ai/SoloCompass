import { useState, useEffect } from 'react';
import { Shield, Sun, Moon, Flag, AlertTriangle, MapPin } from 'lucide-react';
import api from '../../lib/api';
import SafetyReportForm from './SafetyReportForm';

const SAFETY_COLORS = {
  safe: { bg: 'bg-success/10', border: 'border-success/30', text: 'text-success', dot: 'bg-success' },
  moderate: { bg: 'bg-warning/10', border: 'border-warning/30', text: 'text-warning', dot: 'bg-warning' },
  caution: { bg: 'bg-orange-100', border: 'border-orange-300', text: 'text-orange-600', dot: 'bg-orange-500' },
  avoid: { bg: 'bg-error/10', border: 'border-error/30', text: 'text-error', dot: 'bg-error' }
};

const SAFETY_LABELS = {
  safe: 'Safe',
  moderate: 'Generally Safe',
  caution: 'Use Caution',
  avoid: 'Avoid'
};

export default function SafetyMapOverlay({ destinationId }) {
  const [areas, setAreas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isNight, setIsNight] = useState(false);
  const [showReportForm, setShowReportForm] = useState(false);

  useEffect(() => {
    if (!destinationId) return;
    fetchAreas();
  }, [destinationId]);

  const fetchAreas = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/safety-areas/${destinationId}`);
      setAreas(res.data?.data || []);
    } catch (err) {
      // silently fail - safety overlay is supplemental
    } finally {
      setLoading(false);
    }
  };

  const currentSafetyKey = isNight ? 'night_safety' : 'day_safety';

  return (
    <div className="space-y-4">
      {/* Legend + toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          {Object.entries(SAFETY_LABELS).map(([level, label]) => (
            <div key={level} className="flex items-center gap-1.5">
              <div className={`w-3 h-3 rounded-full ${SAFETY_COLORS[level].dot}`} />
              <span className="text-xs text-base-content/60">{label}</span>
            </div>
          ))}
        </div>
        <button
          onClick={() => setIsNight(!isNight)}
          className="flex items-center gap-1.5 px-3 py-1.5 border border-base-300 rounded-lg text-xs font-bold hover:bg-base-200 transition-colors"
        >
          {isNight ? <Moon size={12} /> : <Sun size={12} />}
          {isNight ? 'Night' : 'Day'}
        </button>
      </div>

      {/* Areas */}
      {loading ? (
        <div className="text-center text-base-content/60 text-sm py-4">Loading safety data...</div>
      ) : areas.length === 0 && destinationId ? (
        <div className="text-center text-base-content/60 text-sm py-4">
          <Shield size={24} className="mx-auto mb-2 opacity-30" />
          No safety area data available for this destination.
        </div>
      ) : (
        <div className="space-y-2">
          {areas.map((area) => {
            const level = area[currentSafetyKey] || area.safety_level || 'moderate';
            const colors = SAFETY_COLORS[level] || SAFETY_COLORS.moderate;
            return (
              <div key={area.id} className={`border rounded-xl p-3 ${colors.bg} ${colors.border}`}>
                <div className="flex items-start gap-3">
                  <div className={`w-3 h-3 rounded-full mt-1 shrink-0 ${colors.dot}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-black text-sm text-base-content">{area.name}</p>
                      <span className={`text-[10px] font-black uppercase px-1.5 py-0.5 rounded-full ${colors.text} ${colors.bg} border ${colors.border}`}>
                        {SAFETY_LABELS[level] || level}
                      </span>
                    </div>
                    {area.description && (
                      <p className="text-xs text-base-content/70 mt-1">{area.description}</p>
                    )}
                    {area.notes && (
                      <p className="text-xs text-base-content/50 mt-1 italic">{area.notes}</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Report button */}
      <button
        onClick={() => setShowReportForm(!showReportForm)}
        className="w-full flex items-center justify-center gap-2 border border-base-300 rounded-xl py-2.5 text-sm font-bold text-base-content/70 hover:bg-base-200 transition-colors"
      >
        <Flag size={14} />
        {showReportForm ? 'Cancel' : 'Report a Safety Issue'}
      </button>

      {showReportForm && (
        <div className="border border-base-300 rounded-xl p-4">
          <SafetyReportForm onSubmitted={() => setShowReportForm(false)} />
        </div>
      )}
    </div>
  );
}

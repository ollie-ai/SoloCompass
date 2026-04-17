import { useState, useEffect } from 'react';
import { Shield, Sun, Moon, Flag, Layers, ChevronDown, ChevronUp } from 'lucide-react';
import api from '../../lib/api';
import SafetyReportForm from './SafetyReportForm';
import AreaSafetyDetail from './AreaSafetyDetail';

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
  const [showOverlay, setShowOverlay] = useState(true);
  const [selectedArea, setSelectedArea] = useState(null);

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
      // silently fail — could be tier gated or no data
    } finally {
      setLoading(false);
    }
  };

  const currentSafetyKey = isNight ? 'night_safety' : 'day_safety';

  return (
    <div className="space-y-4">
      {/* Controls bar: legend + day/night + layer toggle */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          {Object.entries(SAFETY_LABELS).map(([level, label]) => (
            <div key={level} className="flex items-center gap-1.5">
              <div className={`w-2.5 h-2.5 rounded-full ${SAFETY_COLORS[level].dot}`} />
              <span className="text-[10px] text-base-content/60">{label}</span>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsNight(!isNight)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 border border-base-300 rounded-lg text-xs font-bold hover:bg-base-200 transition-colors"
          >
            {isNight ? <Moon size={11} /> : <Sun size={11} />}
            {isNight ? 'Night' : 'Day'}
          </button>
          <button
            onClick={() => setShowOverlay(!showOverlay)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 border rounded-lg text-xs font-bold transition-colors ${
              showOverlay
                ? 'border-brand-vibrant bg-brand-vibrant/10 text-brand-vibrant'
                : 'border-base-300 text-base-content/50 hover:bg-base-200'
            }`}
            title="Toggle safety overlay"
          >
            <Layers size={11} />
            Overlay
          </button>
        </div>
      </div>

      {/* Selected area detail */}
      {selectedArea && (
        <AreaSafetyDetail
          area={selectedArea}
          isNight={isNight}
          onClose={() => setSelectedArea(null)}
        />
      )}

      {/* Areas list */}
      {showOverlay && (
        <>
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
                const isSelected = selectedArea?.id === area.id;
                return (
                  <div
                    key={area.id}
                    className={`border rounded-xl p-3 cursor-pointer transition-all ${colors.bg} ${colors.border} ${isSelected ? 'ring-2 ring-brand-vibrant/40' : 'hover:opacity-90'}`}
                    onClick={() => setSelectedArea(isSelected ? null : area)}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-3 h-3 rounded-full mt-1 shrink-0 ${colors.dot}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-black text-sm text-base-content">{area.name}</p>
                          <div className="flex items-center gap-1">
                            <span className={`text-[10px] font-black uppercase px-1.5 py-0.5 rounded-full ${colors.text} ${colors.bg} border ${colors.border}`}>
                              {SAFETY_LABELS[level] || level}
                            </span>
                            {isSelected ? <ChevronUp size={12} className="text-base-content/40" /> : <ChevronDown size={12} className="text-base-content/40" />}
                          </div>
                        </div>
                        {area.description && !isSelected && (
                          <p className="text-xs text-base-content/70 mt-1 truncate">{area.description}</p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
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

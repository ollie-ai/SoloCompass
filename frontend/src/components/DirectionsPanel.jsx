import { useState } from 'react';
import { MapPin, Navigation, Bus, Footprints, Car, Clock, ArrowRight, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import DOMPurify from 'dompurify';
import api from '../lib/api';

const MODES = [
  { value: 'transit', label: 'Transit', icon: Bus },
  { value: 'walking', label: 'Walk', icon: Footprints },
  { value: 'driving', label: 'Drive', icon: Car },
];

function extractPlainText(html) {
  if (!html) return '';
  // Sanitize first, then extract text via a temporary element
  const clean = DOMPurify.sanitize(html, { ALLOWED_TAGS: [] });
  const el = document.createElement('span');
  el.innerHTML = clean;
  return el.textContent || el.innerText || '';
}

const StepItem = ({ step, index }) => {
  const instruction = step.html_instructions
    ? extractPlainText(step.html_instructions)
    : step.maneuver?.instruction || step.instructions || '';
  const dist = step.distance?.text || step.distance || '';
  const dur = step.duration?.text || step.duration || '';

  return (
    <div className="flex gap-3 text-sm">
      <span className="w-5 h-5 rounded-full bg-brand-vibrant/10 text-brand-vibrant text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5">
        {index + 1}
      </span>
      <div className="flex-1">
        <p className="font-medium text-base-content/80">{instruction}</p>
        {(dist || dur) && (
          <p className="text-xs text-base-content/40 mt-0.5">
            {[dist, dur].filter(Boolean).join(' · ')}
          </p>
        )}
      </div>
    </div>
  );
};

const DirectionsPanel = ({ defaultOrigin = '', defaultDestination = '', className = '' }) => {
  const [origin, setOrigin] = useState(defaultOrigin);
  const [destination, setDestination] = useState(defaultDestination);
  const [mode, setMode] = useState('transit');
  const [route, setRoute] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showSteps, setShowSteps] = useState(false);

  const handleGetDirections = async (e) => {
    e.preventDefault();
    if (!origin.trim() || !destination.trim()) return;
    setLoading(true);
    setError(null);
    setRoute(null);
    try {
      const res = await api.get('/directions', { params: { origin: origin.trim(), destination: destination.trim(), mode } });
      const routes = res.data?.data?.routes || [];
      if (routes.length === 0) {
        setError('No route found between these locations.');
        return;
      }
      setRoute(routes[0]);
      setShowSteps(false);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to get directions');
    } finally {
      setLoading(false);
    }
  };

  const steps = route?.legs?.[0]?.steps || route?.steps || [];
  const summary = route?.legs?.[0] || route;
  const totalDist = summary?.distance?.text || '';
  const totalDur = summary?.duration?.text || '';

  return (
    <div className={`rounded-xl border border-base-300/60 bg-base-100 p-5 ${className}`}>
      <h3 className="font-black text-base-content text-base mb-4 flex items-center gap-2">
        <Navigation size={16} className="text-brand-vibrant" /> Directions
      </h3>

      <form onSubmit={handleGetDirections} className="space-y-3 mb-4">
        <div className="relative">
          <MapPin size={14} className="absolute left-3 top-3 text-base-content/40" />
          <input
            value={origin}
            onChange={e => setOrigin(e.target.value)}
            placeholder="From"
            className="w-full pl-8 pr-3 py-2.5 text-sm rounded-xl border border-base-300 bg-base-100 focus:border-brand-vibrant focus:ring-2 focus:ring-brand-vibrant/20 outline-none"
          />
        </div>
        <div className="relative">
          <MapPin size={14} className="absolute left-3 top-3 text-brand-vibrant" />
          <input
            value={destination}
            onChange={e => setDestination(e.target.value)}
            placeholder="To"
            className="w-full pl-8 pr-3 py-2.5 text-sm rounded-xl border border-base-300 bg-base-100 focus:border-brand-vibrant focus:ring-2 focus:ring-brand-vibrant/20 outline-none"
          />
        </div>

        <div className="flex gap-2">
          {MODES.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              onClick={() => setMode(value)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold border transition-colors ${mode === value ? 'bg-brand-vibrant text-white border-brand-vibrant' : 'border-base-300 text-base-content/60 hover:border-brand-vibrant'}`}
            >
              <Icon size={13} /> {label}
            </button>
          ))}
        </div>

        <button
          type="submit"
          disabled={loading || !origin.trim() || !destination.trim()}
          className="w-full py-2.5 rounded-xl bg-brand-vibrant text-white text-sm font-bold hover:bg-emerald-600 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Navigation size={14} />}
          {loading ? 'Getting directions…' : 'Get Directions'}
        </button>
      </form>

      {error && (
        <p className="text-xs text-error bg-error/10 p-3 rounded-xl">{error}</p>
      )}

      {route && (
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-base-200/60 rounded-xl">
            <div className="flex items-center gap-4">
              {totalDur && (
                <span className="flex items-center gap-1.5 text-sm font-black text-base-content">
                  <Clock size={14} className="text-brand-vibrant" /> {totalDur}
                </span>
              )}
              {totalDist && (
                <span className="flex items-center gap-1.5 text-sm font-medium text-base-content/60">
                  <ArrowRight size={14} /> {totalDist}
                </span>
              )}
            </div>
          </div>

          {steps.length > 0 && (
            <div>
              <button
                onClick={() => setShowSteps(s => !s)}
                className="flex items-center gap-1.5 text-xs font-bold text-base-content/60 hover:text-base-content mb-2"
              >
                {showSteps ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                {showSteps ? 'Hide steps' : `Show ${steps.length} steps`}
              </button>
              {showSteps && (
                <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                  {steps.map((step, i) => <StepItem key={i} step={step} index={i} />)}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DirectionsPanel;

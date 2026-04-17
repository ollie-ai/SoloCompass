import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle, ChevronRight, Globe, MapPin, ShieldCheck } from 'lucide-react';

const SAFETY_LABELS = {
  high: { label: 'Safe', tone: 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20' },
  medium: { label: 'Caution', tone: 'text-yellow-700 bg-yellow-500/10 border-yellow-500/20' },
  low: { label: 'High caution', tone: 'text-red-700 bg-red-500/10 border-red-500/20' },
};

const COST_LABELS = {
  budget: 'Budget',
  mid: 'Mid-range',
  medium: 'Mid-range',
  luxury: 'Premium',
};

function getSoloScore(destination) {
  const raw = destination?.solo_score ?? destination?.solo_safety_index ?? destination?.solo_friendly_rating ?? destination?.solo_safety_score;
  const numeric = Number(raw);
  if (!Number.isFinite(numeric)) return null;
  if (numeric > 10) return Math.max(0, Math.min(10, numeric / 10));
  return Math.max(0, Math.min(10, numeric));
}

export default function DestinationCard({ destination, level = 'city' }) {
  const id = destination?.id;
  const slug = destination?.slug;
  const displayName = destination?.title || destination?.name || 'Destination';
  const image = destination?.image_url;
  const href = slug
    ? level === 'country'
      ? `/destinations/countries/${slug}`
      : `/destinations/cities/${slug}`
    : `/destinations/${id}`;

  const safetyRating = destination?.safety_rating;
  const advisory = destination?.advisory_stance;
  const safety = SAFETY_LABELS[safetyRating] || null;
  const cost = COST_LABELS[destination?.budget_level] || (destination?.budget_level ? String(destination.budget_level) : null);
  const soloScore = getSoloScore(destination);

  return (
    <div className="group glass-card rounded-2xl overflow-hidden border border-base-300/50 hover:border-brand-vibrant/30 hover:shadow-xl transition-all duration-300 flex flex-col">
      <div className="relative h-36 overflow-hidden bg-base-200">
        {image ? (
          <img src={image} alt={`${displayName} view`} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-base-content/20">
            {level === 'country' ? <Globe size={30} /> : <MapPin size={30} />}
          </div>
        )}
        <div className="absolute top-3 left-3">
          <span className="px-2.5 py-1 rounded-lg bg-black/45 text-white text-[10px] font-black uppercase tracking-wider">
            {level}
          </span>
        </div>
      </div>

      <div className="p-4 flex flex-col gap-2.5 flex-1">
        <h3 className="text-base font-black text-base-content leading-tight tracking-tight">{displayName}</h3>

        <div className="flex flex-wrap items-center gap-2">
          {safety && (
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border text-xs font-bold ${safety.tone}`}>
              {safetyRating === 'high' ? <ShieldCheck size={11} /> : <AlertTriangle size={11} />} {safety.label}
            </span>
          )}
          {!safety && advisory && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border text-xs font-bold bg-warning/10 text-warning border-warning/30">
              <AlertTriangle size={11} /> Advisory
            </span>
          )}
          {cost && (
            <span className="px-2 py-0.5 rounded-lg bg-base-200 border border-base-300/60 text-xs font-bold text-base-content/70">
              {cost}
            </span>
          )}
          {soloScore !== null && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-brand-vibrant/10 text-brand-vibrant text-xs font-black border border-brand-vibrant/20">
              <CheckCircle size={11} /> Solo {soloScore.toFixed(1)}/10
            </span>
          )}
        </div>

        <p className="text-xs text-base-content/60 line-clamp-2">
          {destination?.short_summary || destination?.description || 'Explore details, safety context, and trip planning guidance.'}
        </p>

        <div className="mt-auto pt-1">
          <Link
            to={href}
            className="flex items-center justify-between w-full px-3 py-2 rounded-xl bg-base-200 hover:bg-brand-vibrant hover:text-white text-base-content/70 font-black text-xs transition-all border border-base-300/50 hover:border-brand-vibrant"
          >
            <span>View details</span>
            <ChevronRight size={14} />
          </Link>
        </div>
      </div>
    </div>
  );
}

/**
 * CountryHero — Hero section with positioning + CTAs + best-for/caution-for
 */

import { Link } from 'react-router-dom';
import { Globe, MapPin, Sun, Wind, ChevronRight, BookmarkPlus, Sparkles } from 'lucide-react';

function parseTags(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try { return JSON.parse(raw); } catch { return []; }
}

const CLIMATE_MAP = {
  tropical: { label: 'Tropical', icon: Sun },
  arid: { label: 'Arid', icon: Wind },
  temperate: { label: 'Temperate', icon: Sun },
  continental: { label: 'Continental', icon: Wind },
  mediterranean: { label: 'Mediterranean', icon: Sun },
  subarctic: { label: 'Cold', icon: Wind },
};

const BUDGET_CHIP = {
  backpacker: { label: 'Backpacker', range: '$', color: 'bg-emerald-500/10 text-emerald-600' },
  budget: { label: 'Budget', range: '$', color: 'bg-emerald-500/10 text-emerald-600' },
  midrange: { label: 'Mid-range', range: '$$', color: 'bg-yellow-500/10 text-yellow-600' },
  comfort: { label: 'Comfort', range: '$$$', color: 'bg-orange-500/10 text-orange-600' },
  luxury: { label: 'Luxury', range: '$$$$', color: 'bg-purple-500/10 text-purple-600' },
};

export default function CountryHero({ destination, onSave }) {
  const {
    id,
    slug,
    name,
    title,
    image_url,
    country,
    region_name,
    short_summary,
    positioning_summary,
    solo_fit_tags,
    best_for_tags,
    caution_for_tags,
    budget_band,
    climate,
  } = destination || {};

  const displayName = title || name;
  const soloTags = parseTags(solo_fit_tags);
  const bestTags = parseTags(best_for_tags);
  const cautionTags = parseTags(caution_for_tags);
  const budgetInfo = budget_band ? BUDGET_CHIP[budget_band] : null;
  const climateInfo = climate ? CLIMATE_MAP[climate?.toLowerCase()] : null;
  const ClimateIcon = climateInfo?.icon || Sun;
  const href = slug ? `/destinations/countries/${slug}` : `/destinations/${id}`;

  if (!destination) return null;

  return (
    <section className="relative overflow-hidden bg-base-200">
      {/* Background image */}
      <div className="absolute inset-0 h-full min-h-[400px]">
        {image_url ? (
          <img src={image_url} alt={`${displayName} landscape`} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-base-300 to-base-200 flex items-center justify-center">
            <Globe size={64} className="text-base-content/20" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-base-100 via-base-100/60 to-transparent" />
      </div>

      <div className="relative max-w-6xl mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-2 gap-8 items-center">
          {/* Left content */}
          <div className="space-y-5">
            {/* Breadcrumb */}
            <Link to="/destinations" className="inline-flex items-center gap-2 text-sm text-base-content/60 hover:text-brand-vibrant transition-colors">
              <Globe size={14} /> All destinations
            </Link>

            {/* Level tag */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-3 py-1.5 rounded-lg bg-brand-vibrant/10 border border-brand-vibrant/20 text-brand-vibrant text-xs font-black uppercase tracking-widest flex items-center gap-1.5">
                <Globe size={12} /> Country Guide
              </span>
              {region_name && (
                <span className="px-2.5 py-1 rounded-lg bg-base-100/60 backdrop-blur-sm text-base-content text-xs font-bold">
                  {region_name}
                </span>
              )}
            </div>

            {/* Country name */}
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-black text-base-content tracking-tight leading-tight">
              {displayName}
            </h1>

            {/* Positioning summary */}
            {positioning_summary && (
              <p className="text-lg text-base-content/70 leading-relaxed max-w-lg">
                {positioning_summary}
              </p>
            )}

            {/* Best-for tags */}
            {bestTags.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-base-content/50 uppercase tracking-wider">Best for</span>
                {bestTags.slice(0, 4).map((tag) => (
                  <span key={tag} className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 text-xs font-bold border border-emerald-500/20">
                    {tag.replace(/-/g, ' ')}
                  </span>
                ))}
              </div>
            )}

            {/* Caution-for tags */}
            {cautionTags.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-base-content/50 uppercase tracking-wider">Watch for</span>
                {cautionTags.slice(0, 3).map((tag) => (
                  <span key={tag} className="px-2.5 py-1 rounded-lg bg-orange-500/10 text-orange-600 text-xs font-bold border border-orange-500/20">
                    {tag.replace(/-/g, ' ')}
                  </span>
                ))}
              </div>
            )}

            {/* Budget + Climate pills */}
            <div className="flex flex-wrap items-center gap-3">
              {budgetInfo && (
                <div className={`px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 ${budgetInfo.color}`}>
                  <span className="opacity-60">Budget:</span> {budgetInfo.label}
                  <span className="ml-1 opacity-60">{budgetInfo.range}</span>
                </div>
              )}
              {climateInfo && (
                <div className="px-3 py-1.5 rounded-full bg-blue-500/10 text-blue-600 text-xs font-bold flex items-center gap-1.5 border border-blue-500/20">
                  <ClimateIcon size={12} /> {climateInfo.label}
                </div>
              )}
            </div>

            {/* CTAs */}
            <div className="flex flex-wrap gap-3 pt-2">
              <Link
                to={`${href}#cities`}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-brand-vibrant text-white font-black text-sm transition-all hover:bg-brand-vibrant/90 hover:shadow-lg hover:shadow-brand-vibrant/20"
              >
                <MapPin size={16} /> Explore Cities
                <ChevronRight size={14} />
              </Link>
              <button
                onClick={() => onSave?.(destination)}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-base-100/60 backdrop-blur-sm text-base-content font-black text-sm transition-all hover:bg-base-100 border border-base-300/50 hover:border-brand-vibrant/30"
              >
                <BookmarkPlus size={16} /> Save Destination
              </button>
            </div>
          </div>

          {/* Right - Editorial image placeholder */}
          <div className="hidden lg:block aspect-[4/3] rounded-2xl overflow-hidden border border-base-300/50 shadow-2xl">
            {image_url ? (
              <img src={image_url} alt={`${displayName} editorial photo`} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-brand-vibrant/20 to-base-200 flex items-center justify-center">
                <Sparkles size={48} className="text-brand-vibrant/30" />
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
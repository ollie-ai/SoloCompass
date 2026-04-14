/**
 * SafetyFilterBar — trust-aware filters for the destination explore page.
 * Allows filtering by: destination level, advisory stance, travel style, budget,
 * region, solo score minimum, climate, and solo-specific tags.
 */

import { Globe, MapPin, ShieldCheck, Search, X, SlidersHorizontal } from 'lucide-react';

const LEVEL_OPTIONS = [
  { value: 'all', label: 'All destinations' },
  { value: 'country', label: 'Countries', icon: Globe },
  { value: 'city', label: 'Cities', icon: MapPin },
];

const ADVISORY_OPTIONS = [
  { value: 'all', label: 'All advisories' },
  { value: 'normal', label: 'Normal travel', color: 'text-emerald-600' },
  { value: 'exercise_caution', label: 'Exercise caution', color: 'text-yellow-600' },
];

const BUDGET_OPTIONS = [
  { value: 'all', label: 'Any budget' },
  { value: 'budget', label: 'Budget' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'luxury', label: 'Luxury' },
];

const REGION_OPTIONS = [
  { value: 'all', label: 'All regions' },
  { value: 'europe', label: 'Europe' },
  { value: 'asia', label: 'Asia' },
  { value: 'americas', label: 'Americas' },
  { value: 'africa', label: 'Africa' },
  { value: 'oceania', label: 'Oceania' },
  { value: 'middle_east', label: 'Middle East' },
];

const CLIMATE_OPTIONS = [
  { value: 'all', label: 'Any climate' },
  { value: 'tropical', label: 'Tropical' },
  { value: 'temperate', label: 'Temperate' },
  { value: 'arid', label: 'Arid / Desert' },
  { value: 'cold', label: 'Cold / Arctic' },
  { value: 'mediterranean', label: 'Mediterranean' },
];

const SOLO_TAG_OPTIONS = [
  { value: 'solo_female_friendly', label: 'Solo-female friendly' },
  { value: 'lgbtq_friendly', label: 'LGBTQ+ friendly' },
  { value: 'digital_nomad', label: 'Digital nomad' },
  { value: 'budget_backpacker', label: 'Budget backpacker' },
  { value: 'wellness', label: 'Wellness / retreat' },
];

export default function SafetyFilterBar({ filters, onChange }) {
  const {
    search = '',
    level = 'all',
    advisory = 'all',
    budget = 'all',
    region = 'all',
    solo_score_min = 0,
    climate = 'all',
    tags = [],
  } = filters;

  const update = (key, value) => onChange({ ...filters, [key]: value });

  const toggleTag = (tag) => {
    const current = Array.isArray(tags) ? tags : [];
    const updated = current.includes(tag) ? current.filter(t => t !== tag) : [...current, tag];
    update('tags', updated);
  };

  const hasActiveFilters =
    level !== 'all' ||
    advisory !== 'all' ||
    budget !== 'all' ||
    region !== 'all' ||
    climate !== 'all' ||
    solo_score_min > 0 ||
    (Array.isArray(tags) && tags.length > 0) ||
    search;

  const clearAll = () =>
    onChange({ search: '', level: 'all', advisory: 'all', budget: 'all', region: 'all', solo_score_min: 0, climate: 'all', tags: [] });

  return (
    <div className="flex flex-col gap-4">
      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-base-content/40" />
        <input
          type="text"
          placeholder="Search destinations…"
          value={search}
          onChange={(e) => update('search', e.target.value)}
          className="w-full pl-10 pr-4 py-3 rounded-xl bg-base-200 border border-base-300/50 text-base-content placeholder:text-base-content/40 focus:outline-none focus:border-brand-vibrant/40 focus:bg-base-100 transition-all font-medium"
          aria-label="Search destinations"
        />
        {search && (
          <button
            onClick={() => update('search', '')}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-base-content/40 hover:text-base-content transition-colors"
            aria-label="Clear search"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Primary filter chips row */}
      <div className="flex flex-wrap gap-2 items-center">
        {/* Level toggle */}
        <div className="flex gap-1 p-1 bg-base-200 rounded-xl border border-base-300/50">
          {LEVEL_OPTIONS.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              onClick={() => update('level', value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 ${
                level === value
                  ? 'bg-brand-vibrant text-white shadow-sm'
                  : 'text-base-content/60 hover:text-base-content hover:bg-base-100'
              }`}
              aria-pressed={level === value}
            >
              {Icon && <Icon size={12} />}
              {label}
            </button>
          ))}
        </div>

        {/* Advisory filter */}
        <select
          value={advisory}
          onChange={(e) => update('advisory', e.target.value)}
          className="px-3 py-2 rounded-xl bg-base-200 border border-base-300/50 text-xs font-bold text-base-content/70 focus:outline-none focus:border-brand-vibrant/40 transition-all"
          aria-label="Filter by advisory"
        >
          {ADVISORY_OPTIONS.map(({ value, label }) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>

        {/* Budget filter */}
        <select
          value={budget}
          onChange={(e) => update('budget', e.target.value)}
          className="px-3 py-2 rounded-xl bg-base-200 border border-base-300/50 text-xs font-bold text-base-content/70 focus:outline-none focus:border-brand-vibrant/40 transition-all"
          aria-label="Filter by budget"
        >
          {BUDGET_OPTIONS.map(({ value, label }) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>

        {/* Region filter */}
        <select
          value={region}
          onChange={(e) => update('region', e.target.value)}
          className="px-3 py-2 rounded-xl bg-base-200 border border-base-300/50 text-xs font-bold text-base-content/70 focus:outline-none focus:border-brand-vibrant/40 transition-all"
          aria-label="Filter by region"
        >
          {REGION_OPTIONS.map(({ value, label }) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>

        {/* Climate filter */}
        <select
          value={climate}
          onChange={(e) => update('climate', e.target.value)}
          className="px-3 py-2 rounded-xl bg-base-200 border border-base-300/50 text-xs font-bold text-base-content/70 focus:outline-none focus:border-brand-vibrant/40 transition-all"
          aria-label="Filter by climate"
        >
          {CLIMATE_OPTIONS.map(({ value, label }) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>

        {/* Clear filters */}
        {hasActiveFilters && (
          <button
            onClick={clearAll}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-base-content/50 hover:text-base-content hover:bg-base-200 transition-all"
          >
            <X size={12} /> Clear filters
          </button>
        )}
      </div>

      {/* Solo score minimum slider */}
      <div className="flex items-center gap-3">
        <SlidersHorizontal size={14} className="text-base-content/40 shrink-0" />
        <span className="text-xs font-bold text-base-content/60 whitespace-nowrap">Min solo score</span>
        <input
          type="range"
          min={0}
          max={10}
          step={1}
          value={solo_score_min}
          onChange={(e) => update('solo_score_min', Number(e.target.value))}
          className="flex-1 accent-brand-vibrant"
          aria-label="Minimum solo score"
        />
        <span className="text-xs font-black text-brand-vibrant w-5 text-right">{solo_score_min > 0 ? solo_score_min : '—'}</span>
      </div>

      {/* Solo-specific tags */}
      <div className="flex flex-wrap gap-2">
        {SOLO_TAG_OPTIONS.map(({ value, label }) => {
          const active = Array.isArray(tags) && tags.includes(value);
          return (
            <button
              key={value}
              onClick={() => toggleTag(value)}
              aria-pressed={active}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                active
                  ? 'bg-brand-vibrant/10 border-brand-vibrant/40 text-brand-vibrant'
                  : 'bg-base-200 border-base-300/50 text-base-content/60 hover:text-base-content hover:bg-base-100'
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}


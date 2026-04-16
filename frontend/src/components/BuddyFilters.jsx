import { useState } from 'react';
import PropTypes from 'prop-types';
import { AnimatePresence, motion } from 'framer-motion';
import { Calendar, ChevronDown, Filter, Globe, Sparkles, Users, X } from 'lucide-react';

const INTERESTS = [
  'Hiking', 'Photography', 'Food', 'Culture', 'Nightlife', 'Beach',
  'Adventure', 'History', 'Art', 'Music', 'Yoga', 'Backpacking',
  'Wildlife', 'Cycling', 'Surfing', 'Budget travel', 'Luxury travel',
];

const GENDER_PREFS = [
  { value: '', label: 'Any' },
  { value: 'female', label: 'Female solo travelers' },
  { value: 'male', label: 'Male solo travelers' },
  { value: 'non_binary', label: 'Non-binary travelers' },
];

/**
 * BuddyFilters – destination, date-range, interests, and gender-preference
 * filter bar for the buddy discover view.
 *
 * Props:
 *  filters          – current filter values
 *  onChange(filters) – called whenever any filter changes
 *  onSearch()        – called when the user triggers an explicit search
 *  suggestions       – destination autocomplete suggestions list
 */
function BuddyFilters({ filters = {}, onChange, onSearch, suggestions = [] }) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const update = (key, value) => {
    onChange?.({ ...filters, [key]: value });
  };

  const toggleInterest = (interest) => {
    const current = filters.interests || [];
    const next = current.includes(interest)
      ? current.filter((i) => i !== interest)
      : [...current, interest];
    update('interests', next);
  };

  const clearAll = () => {
    onChange?.({ destination: '', startDate: '', endDate: '', interests: [], genderPref: '' });
  };

  const hasActiveFilters =
    filters.destination ||
    filters.startDate ||
    filters.endDate ||
    (filters.interests || []).length > 0 ||
    filters.genderPref;

  const filteredSuggestions = (suggestions || []).filter(
    (s) =>
      s.toLowerCase().includes((filters.destination || '').toLowerCase()) &&
      (filters.destination || '').length > 0
  );

  return (
    <div className="glass-card p-4 mb-8 space-y-3 relative z-30">
      {/* Destination row */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Globe className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/30" size={16} />
          <input
            type="text"
            placeholder="Filter by destination…"
            value={filters.destination || ''}
            onChange={(e) => {
              update('destination', e.target.value);
              setShowSuggestions(true);
            }}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                setShowSuggestions(false);
                onSearch?.();
              }
            }}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-base-300 bg-base-100 text-sm font-medium"
          />

          <AnimatePresence>
            {showSuggestions && filteredSuggestions.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                className="absolute top-full left-0 right-0 mt-1 bg-base-100 border border-base-300 rounded-xl shadow-xl z-50 overflow-hidden"
              >
                {filteredSuggestions.map((s) => (
                  <button
                    key={s}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      update('destination', s);
                      setShowSuggestions(false);
                    }}
                    className="w-full text-left px-4 py-2 text-sm hover:bg-base-200 flex items-center gap-2"
                  >
                    <Globe size={12} className="text-base-content/30" />
                    {s}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <button
          onClick={() => setShowAdvanced((v) => !v)}
          className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl border text-xs font-bold transition-colors ${
            showAdvanced || hasActiveFilters
              ? 'border-brand-vibrant/40 text-brand-vibrant bg-brand-vibrant/5'
              : 'border-base-300 text-base-content/60 hover:border-base-300/80'
          }`}
        >
          <Filter size={12} /> Filters
          {hasActiveFilters && (
            <span className="ml-1 px-1.5 py-0.5 rounded-full bg-brand-vibrant text-white text-[9px] font-black">
              {[
                filters.destination ? 1 : 0,
                (filters.startDate || filters.endDate) ? 1 : 0,
                (filters.interests || []).length,
                filters.genderPref ? 1 : 0,
              ].reduce((a, b) => a + b, 0)}
            </span>
          )}
          <ChevronDown size={12} className={`transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
        </button>

        <button
          onClick={() => { setShowSuggestions(false); onSearch?.(); }}
          className="px-5 py-2.5 rounded-xl font-bold text-sm bg-brand-vibrant text-white shadow-md shadow-brand-vibrant/20 hover:bg-emerald-600 transition-colors"
        >
          Search
        </button>
      </div>

      {/* Advanced filters */}
      <AnimatePresence>
        {showAdvanced && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="pt-3 space-y-4 border-t border-base-300/50">
              {/* Date range */}
              <div className="grid grid-cols-2 gap-3">
                <label className="form-control">
                  <span className="text-[10px] font-bold uppercase tracking-wide text-base-content/50 mb-1 flex items-center gap-1">
                    <Calendar size={10} /> From date
                  </span>
                  <input
                    type="date"
                    value={filters.startDate || ''}
                    onChange={(e) => update('startDate', e.target.value)}
                    className="w-full rounded-xl border border-base-300 bg-base-100 px-3 py-2 text-sm"
                  />
                </label>
                <label className="form-control">
                  <span className="text-[10px] font-bold uppercase tracking-wide text-base-content/50 mb-1 flex items-center gap-1">
                    <Calendar size={10} /> To date
                  </span>
                  <input
                    type="date"
                    value={filters.endDate || ''}
                    onChange={(e) => update('endDate', e.target.value)}
                    min={filters.startDate || ''}
                    className="w-full rounded-xl border border-base-300 bg-base-100 px-3 py-2 text-sm"
                  />
                </label>
              </div>

              {/* Gender preference */}
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wide text-base-content/50 mb-1.5 flex items-center gap-1">
                  <Users size={10} /> Gender preference (optional)
                </span>
                <div className="flex flex-wrap gap-2">
                  {GENDER_PREFS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => update('genderPref', opt.value)}
                      className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-colors ${
                        filters.genderPref === opt.value
                          ? 'border-brand-vibrant/40 bg-brand-vibrant/10 text-brand-vibrant'
                          : 'border-base-300 text-base-content/60 hover:border-brand-vibrant/20'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Interests */}
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wide text-base-content/50 mb-1.5 flex items-center gap-1">
                  <Sparkles size={10} /> Shared interests
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {INTERESTS.map((interest) => {
                    const active = (filters.interests || []).includes(interest);
                    return (
                      <button
                        key={interest}
                        onClick={() => toggleInterest(interest)}
                        className={`px-2.5 py-1 rounded-xl border text-[11px] font-bold transition-colors ${
                          active
                            ? 'border-brand-vibrant/40 bg-brand-vibrant/10 text-brand-vibrant'
                            : 'border-base-300 text-base-content/50 hover:border-brand-vibrant/20 hover:text-base-content/70'
                        }`}
                      >
                        {interest}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Clear all */}
              {hasActiveFilters && (
                <button
                  onClick={clearAll}
                  className="flex items-center gap-1.5 text-xs font-bold text-base-content/40 hover:text-error transition-colors"
                >
                  <X size={12} /> Clear all filters
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

BuddyFilters.propTypes = {
  filters: PropTypes.shape({
    destination: PropTypes.string,
    startDate: PropTypes.string,
    endDate: PropTypes.string,
    interests: PropTypes.arrayOf(PropTypes.string),
    genderPref: PropTypes.string,
  }),
  onChange: PropTypes.func,
  onSearch: PropTypes.func,
  suggestions: PropTypes.arrayOf(PropTypes.string),
};

export default BuddyFilters;

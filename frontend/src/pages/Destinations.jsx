import { useState, useEffect, useCallback, useRef } from 'react';
import api, { createCancelToken, isCancel } from '../lib/api';
import Loading from '../components/Loading';
import SEO from '../components/SEO';
import DashboardShell from '../components/dashboard/DashboardShell';
import PageHeader from '../components/PageHeader';
import CountryCard from '../components/destinations/CountryCard';
import CityCard from '../components/destinations/CityCard';
import SafetyFilterBar from '../components/destinations/SafetyFilterBar';
import DestinationGrid from '../components/destinations/DestinationGrid';
import { Globe, MapPin, Sparkles, ShieldCheck } from 'lucide-react';

// --- Featured group config ---
const FEATURED_GROUPS = [
  { key: 'beginner_safe', label: 'Great for first-time solos', icon: '🌱', tags: ['beginner-safe'] },
  { key: 'budget', label: 'Budget-friendly picks', icon: '💰', tags: ['budget'] },
  { key: 'solo_female', label: 'Solo-female friendly', icon: '✨', tags: ['solo-female-friendly'] },
  { key: 'high_comfort', label: 'Higher comfort picks', icon: '🏨', tags: ['high-comfort'] },
];

function parseTags(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try { return JSON.parse(raw); } catch { return []; }
}

function matchesFeaturedGroup(dest, group) {
  const tags = parseTags(dest.solo_fit_tags).concat(parseTags(dest.best_for_tags));
  return group.tags.some(t => tags.includes(t));
}

function matchesFilters(dest, filters) {
  if (filters.search) {
    const q = filters.search.toLowerCase();
    const name = (dest.title || dest.name || '').toLowerCase();
    const country = (dest.country || '').toLowerCase();
    if (!name.includes(q) && !country.includes(q)) return false;
  }
  if (filters.level && filters.level !== 'all') {
    if (dest.destination_level !== filters.level) return false;
  }
  if (filters.advisory && filters.advisory !== 'all') {
    if (dest.advisory_stance !== filters.advisory) return false;
  }
  if (filters.budget && filters.budget !== 'all') {
    if (dest.budget_level !== filters.budget) return false;
  }
  return true;
}

export default function Destinations() {
  const [allDestinations, setAllDestinations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({ search: '', level: 'all', advisory: 'all', budget: 'all' });
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const cancelRef = useRef(null);
  const PAGE_SIZE = 24;

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedSearch(filters.search.trim());
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [filters.search]);

  const fetchDestinations = useCallback(async (pageNum = 1) => {
    if (cancelRef.current) cancelRef.current.cancel('stale');
    cancelRef.current = createCancelToken();
    try {
      setLoading(true);
      const params = new URLSearchParams({ limit: PAGE_SIZE, offset: (pageNum - 1) * PAGE_SIZE });
      if (filters.level !== 'all') params.append('level', filters.level);
      if (filters.budget !== 'all') params.append('budget_level', filters.budget);
      if (debouncedSearch) params.append('search', debouncedSearch);

      const res = await api.get(`/destinations?${params}`, { cancelToken: cancelRef.current.token });
      const data = res.data.data || [];
      setAllDestinations(prev => pageNum === 1 ? data : [...prev, ...data]);
      setTotal(res.data.total || 0);
      setError(null);
    } catch (err) {
      if (!isCancel(err)) setError('Failed to load destinations');
    } finally {
      setLoading(false);
    }
  }, [filters.level, filters.budget, debouncedSearch]);

  useEffect(() => {
    setPage(1);
    setAllDestinations([]);
    fetchDestinations(1);
  }, [fetchDestinations]);

  // Client-side filtering for advisory & search (server already filters level/budget/search)
  const filtered = allDestinations.filter(d => matchesFilters(d, filters));

  const countries = filtered.filter(d => d.destination_level === 'country');
  const cities = filtered.filter(d => d.destination_level !== 'country');
  const isFiltered = filters.search || filters.level !== 'all' || filters.advisory !== 'all' || filters.budget !== 'all';

  return (
    <DashboardShell>
      <SEO
        title="Explore Solo Travel Destinations"
        description="Discover curated destinations for solo travellers. Safety-first, trust-aware destination guides."
      />

      <div className="max-w-7xl mx-auto px-4 py-8 space-y-10">
        {/* Header */}
        <PageHeader
          title="Explore Destinations"
          subtitle="Curated destinations for solo travellers — with honest safety context."
          icon={Sparkles}
        />

        {/* Trust note */}
        <div className="flex items-start gap-3 p-4 rounded-xl bg-brand-vibrant/5 border border-brand-vibrant/15 text-sm text-base-content/70">
          <ShieldCheck size={18} className="text-brand-vibrant flex-shrink-0 mt-0.5" />
          <p>All destinations shown here have passed our safety eligibility gate and manual review. Hidden destinations include stale, blocked, or under-review content.</p>
        </div>

        {/* Filters */}
        <SafetyFilterBar filters={filters} onChange={setFilters} />

        {/* Loading */}
        {loading && allDestinations.length === 0 && (
          <div className="flex justify-center py-16"><Loading /></div>
        )}

        {/* Error */}
        {error && (
          <div className="p-6 rounded-xl bg-error/10 border border-error/20 text-error text-sm font-medium">
            {error}
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && filtered.length === 0 && (
          <div className="py-20 text-center space-y-4">
            <p className="text-3xl">🌍</p>
            <p className="text-xl font-black text-base-content">No destinations found</p>
            <p className="text-base-content/50 text-sm">
              {isFiltered ? 'Try adjusting your filters.' : 'No eligible destinations are published yet.'}
            </p>
            {isFiltered && (
              <button
                onClick={() => setFilters({ search: '', level: 'all', advisory: 'all', budget: 'all' })}
                className="mt-2 px-4 py-2 rounded-xl bg-brand-vibrant/10 text-brand-vibrant font-bold text-sm hover:bg-brand-vibrant hover:text-white transition-all"
              >
                Clear filters
              </button>
            )}
          </div>
        )}

        {/* Featured discovery groups (shown when no active search/filter) */}
        {!isFiltered && !loading && filtered.length > 0 && (
          <div className="space-y-12">
            {FEATURED_GROUPS.map(group => {
              const groupDests = filtered.filter(d => matchesFeaturedGroup(d, group));
              if (groupDests.length === 0) return null;
              return (
                <section key={group.key} aria-labelledby={`group-${group.key}`} className="relative">
                  <div className="flex items-center gap-3 mb-5">
                    {group.icon && <span className="text-xl">{group.icon}</span>}
                    <h2 id={`group-${group.key}`} className="text-lg font-black text-base-content tracking-tight">
                      {group.label}
                    </h2>
                    <span className="text-xs text-base-content/40 font-medium">{groupDests.length} picks</span>
                  </div>
                  <DestinationGrid
                    destinations={groupDests.slice(0, 4)}
                    className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
                    renderCard={(dest) => (
                      dest.destination_level === 'country'
                        ? <CountryCard destination={dest} />
                        : <CityCard destination={dest} />
                    )}
                  />
                </section>
              );
            })}
          </div>
        )}

        {/* Main discovery grid */}
        {filtered.length > 0 && (
          <div className="space-y-8">
            {/* Countries section (when level = all or country) */}
            {(filters.level === 'all' || filters.level === 'country') && countries.length > 0 && (
              <section aria-labelledby="countries-heading" className="space-y-5 pt-4">
                <div className="flex items-center gap-3 pb-3 border-b border-base-300/30">
                  <div className="p-2 rounded-lg bg-brand-vibrant/10">
                    <Globe size={18} className="text-brand-vibrant" />
                  </div>
                  <div>
                    <h2 id="countries-heading" className="text-lg font-black text-base-content tracking-tight">
                      Country Guides
                    </h2>
                    <span className="text-xs text-base-content/40 font-medium">{countries.length} countries</span>
                  </div>
                </div>
                <DestinationGrid
                  destinations={countries}
                  className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5"
                  renderCard={(dest) => <CountryCard destination={dest} />}
                />
              </section>
            )}

            {/* Cities section (when level = all or city) */}
            {(filters.level === 'all' || filters.level === 'city') && cities.length > 0 && (
              <section aria-labelledby="cities-heading" className="space-y-5 pt-4">
                <div className="flex items-center gap-3 pb-3 border-b border-base-300/30">
                  <div className="p-2 rounded-lg bg-brand-vibrant/10">
                    <MapPin size={18} className="text-brand-vibrant" />
                  </div>
                  <div>
                    <h2 id="cities-heading" className="text-lg font-black text-base-content tracking-tight">
                      City Guides
                    </h2>
                    <span className="text-xs text-base-content/40 font-medium">{cities.length} cities</span>
                  </div>
                </div>
                <DestinationGrid
                  destinations={cities}
                  className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4"
                  renderCard={(dest) => <CityCard destination={dest} />}
                />
              </section>
            )}

            {/* Load more */}
            {filtered.length < total && (
              <div className="flex justify-center pt-4">
                <button
                  onClick={() => {
                    const next = page + 1;
                    setPage(next);
                    fetchDestinations(next);
                  }}
                  disabled={loading}
                  className="px-6 py-3 rounded-xl bg-base-200 hover:bg-brand-vibrant hover:text-white border border-base-300/50 hover:border-brand-vibrant text-base-content font-bold text-sm transition-all disabled:opacity-50"
                >
                  {loading ? 'Loading…' : `Load more (${total - filtered.length} remaining)`}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardShell>
  );
}

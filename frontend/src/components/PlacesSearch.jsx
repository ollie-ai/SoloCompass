import { useEffect, useState } from 'react';
import { Search, MapPin, Star, ExternalLink, Loader2, Navigation, Phone, Globe, Clock } from 'lucide-react';
import api from '../lib/api';

const PLACE_TYPES = [
  { value: '', label: 'All Types' },
  { value: 'restaurant', label: 'Restaurants' },
  { value: 'cafe', label: 'Cafes' },
  { value: 'bar', label: 'Bars' },
  { value: 'hotel', label: 'Hotels' },
  { value: 'tourist_attraction', label: 'Attractions' },
  { value: 'museum', label: 'Museums' },
  { value: 'park', label: 'Parks' },
  { value: 'shopping_mall', label: 'Shopping' },
  { value: 'night_club', label: 'Nightlife' },
  { value: 'gym', label: 'Fitness' },
];

const PlacesSearch = ({ destination, onPlaceSelect, compact = false }) => {
  const [query, setQuery] = useState('');
  const [type, setType] = useState('');
  const [results, setResults] = useState([]);
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const response = await api.get('/places/search', {
          params: { query: term, category: type || undefined, radius: 15000 }
        });
        const data = response.data?.data || [];
        setSuggestions(data.slice(0, 8));
        setShowSuggestions(true);
      } catch {
        setSuggestions([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query, type]);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError(null);
    setSelectedPlace(null);

    try {
      const searchQuery = type ? `${query} in ${destination || ''}` : query;
      const response = await api.get('/places/search', {
        params: { q: searchQuery, type: type || undefined }
      });

      if (response.data.success) {
        setResults(response.data.data);
      }
    } catch (err) {
      console.error('Places search error:', err);
      setError(err.response?.data?.message || 'Search failed');
    } finally {
      setLoading(false);
    }
  };

  const handlePlaceClick = async (place) => {
    setLoading(true);
    try {
      const response = await api.get('/places/details', {
        params: { place_id: place.place_id }
      });

      if (response.data.success) {
        setSelectedPlace(response.data.data);
        onPlaceSelect?.(response.data.data);
      }
    } catch (err) {
      console.error('Place details error:', err);
      // Show basic info even if details fail
      setSelectedPlace(place);
    } finally {
      setLoading(false);
    }
  };

  if (compact) {
    return (
      <div className="space-y-3">
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40" size={16} />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search places..."
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-base-300 focus:border-brand-vibrant focus:ring-1 focus:ring-brand-vibrant/20 outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="px-3 py-2 bg-brand-vibrant text-white rounded-lg text-sm font-bold disabled:opacity-50"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : 'Search'}
          </button>
        </form>
        
        {results.length > 0 && (
          <div className="grid grid-cols-2 gap-2">
            {results.slice(0, 4).map(place => (
              <button
                key={place.place_id}
                onClick={() => handlePlaceClick(place)}
                className="text-left p-2 rounded-lg border border-base-300/50 hover:border-brand-vibrant/50 transition-colors"
              >
                <p className="text-sm font-bold text-base-content truncate">{place.name}</p>
                <p className="text-xs text-base-content/60 truncate">{place.address?.split(',')[0]}</p>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="glass-card p-6 rounded-xl">
      <div className="flex items-center gap-2 text-brand-vibrant font-black uppercase text-[10px] tracking-[0.2em] mb-4">
        <Search size={14} /> Find Places
      </div>

      {/* Search Form */}
      <form onSubmit={handleSearch} className="space-y-3 mb-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40" size={16} />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setShowSuggestions(suggestions.length > 0)}
              placeholder={destination ? `Restaurants in ${destination}...` : 'Search for places...'}
              className="w-full pl-9 pr-3 py-3 rounded-xl border border-base-300 focus:border-brand-vibrant focus:ring-2 focus:ring-brand-vibrant/20 outline-none font-bold text-base-content"
            />
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute top-full mt-1 left-0 right-0 z-20 bg-base-100 border border-base-300 rounded-xl shadow-lg max-h-72 overflow-y-auto">
                {suggestions.map((place) => (
                  <button
                    type="button"
                    key={`suggestion-${place.place_id}`}
                    onClick={() => {
                      setShowSuggestions(false);
                      setQuery(place.name || place.address || '');
                      handlePlaceClick(place);
                    }}
                    className="w-full px-3 py-2.5 text-left hover:bg-base-200 transition-colors border-b border-base-300/40 last:border-b-0"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-bold text-base-content truncate">{place.name || place.address}</p>
                      {place.distance ? <span className="text-[10px] text-base-content/50">{Math.round(place.distance)}m</span> : null}
                    </div>
                    <p className="text-xs text-base-content/60 truncate">{place.address}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="flex-1 px-4 py-3 rounded-xl border border-base-300 focus:border-brand-vibrant focus:ring-2 focus:ring-brand-vibrant/20 outline-none font-bold text-base-content bg-base-100 text-sm"
          >
            {PLACE_TYPES.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>

          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="px-6 py-3 bg-brand-vibrant text-white rounded-xl font-bold disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
            Search
          </button>
        </div>
      </form>

      {/* Error */}
      {error && (
        <div className="p-3 bg-error/10 border border-error/30 rounded-xl mb-4">
          <p className="text-sm text-error font-medium">{error}</p>
        </div>
      )}

      {/* Results */}
      {results.length > 0 && !selectedPlace && (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {results.map(place => (
            <button
              key={place.place_id}
              onClick={() => handlePlaceClick(place)}
              className="w-full text-left p-4 rounded-xl border border-base-300/50 hover:border-brand-vibrant/50 hover:bg-brand-vibrant/5 transition-all"
            >
              <div className="flex items-start gap-3">
                {place.photo_url ? (
                  <img src={place.photo_url} alt={`Photo of ${place.name}`} className="w-16 h-16 rounded-lg object-cover" />
                ) : (
                  <div className="w-16 h-16 rounded-lg bg-base-200 flex items-center justify-center">
                    <MapPin size={24} className="text-base-content/30" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-base-content truncate">{place.name}</h4>
                  <p className="text-sm text-base-content/60 truncate">{place.address}</p>
                  <div className="flex items-center gap-2 mt-1">
                    {place.rating && (
                      <div className="flex items-center gap-1">
                        <Star size={12} className="text-amber-400 fill-amber-400" />
                        <span className="text-xs font-bold text-base-content/80">{place.rating}</span>
                        {place.ratings_count && (
                          <span className="text-xs text-base-content/40">({place.ratings_count})</span>
                        )}
                      </div>
                    )}
                    {place.price_level && (
                      <span className="text-xs text-base-content/40">
                        {'$'.repeat(place.price_level)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Selected Place Details */}
      {selectedPlace && (
        <div className="space-y-4">
          <button
            onClick={() => setSelectedPlace(null)}
            className="text-sm font-bold text-base-content/60 hover:text-base-content"
          >
            ← Back to results
          </button>

          <div className="rounded-xl overflow-hidden border border-base-300/50">
            {selectedPlace.photos?.[0] && (
              <img 
                src={selectedPlace.photos[0]} 
                alt={`Photo of ${selectedPlace.name}`}
                className="w-full h-48 object-cover"
              />
            )}
            <div className="p-4">
              <h3 className="text-xl font-black text-base-content mb-2">{selectedPlace.name}</h3>
              <p className="text-sm text-base-content/60 mb-4">{selectedPlace.address}</p>

              <div className="flex flex-wrap gap-4 text-sm">
                {selectedPlace.rating && (
                  <div className="flex items-center gap-1">
                    <Star size={14} className="text-amber-400 fill-amber-400" />
                    <span className="font-bold">{selectedPlace.rating}</span>
                    {selectedPlace.ratings_count && (
                      <span className="text-base-content/40">({selectedPlace.ratings_count} reviews)</span>
                    )}
                  </div>
                )}
                {selectedPlace.price_level && (
                  <span className="font-bold text-base-content/80">
                    {'$'.repeat(selectedPlace.price_level)}
                  </span>
                )}
              </div>

              {/* Opening Hours */}
              {selectedPlace.opening_hours && (
                <div className="mt-4 p-3 bg-base-200 rounded-lg">
                  <div className="flex items-center gap-2 text-sm font-bold text-base-content/80 mb-2">
                    <Clock size={14} /> Hours
                  </div>
                  <ul className="text-xs text-base-content/60 space-y-1">
                    {selectedPlace.opening_hours.map((hours, i) => (
                      <li key={`hours-${hours}-${i}`}>{hours}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Contact Info */}
              <div className="mt-4 flex flex-wrap gap-3">
                {selectedPlace.website && (
                  <a
                    href={selectedPlace.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-sm font-bold text-brand-vibrant hover:underline"
                  >
                    <Globe size={14} /> Website
                  </a>
                )}
                {selectedPlace.phone && (
                  <a
                    href={`tel:${selectedPlace.phone}`}
                    className="flex items-center gap-1 text-sm font-bold text-brand-vibrant hover:underline"
                  >
                    <Phone size={14} /> {selectedPlace.phone}
                  </a>
                )}
                {selectedPlace.location && (
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${selectedPlace.location.lat},${selectedPlace.location.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-sm font-bold text-brand-vibrant hover:underline"
                  >
                    <Navigation size={14} /> Get Directions
                  </a>
                )}
              </div>

              {/* Reviews Preview */}
              {selectedPlace.reviews?.length > 0 && (
                <div className="mt-4 pt-4 border-t border-base-300/50">
                  <h4 className="text-sm font-bold text-base-content/80 mb-2">Recent Reviews</h4>
                  <div className="space-y-2">
                    {selectedPlace.reviews.slice(0, 2).map((review, i) => (
                      <div key={`review-${review.author}-${i}`} className="p-2 bg-base-200 rounded-lg">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-bold text-base-content/80">{review.author}</span>
                          <div className="flex">
                            {[...Array(5)].map((_, j) => (
                              <Star 
                                key={j} 
                                size={10} 
                                className={j < review.rating ? "text-amber-400 fill-amber-400" : "text-base-content/20"} 
                              />
                            ))}
                          </div>
                        </div>
                        <p className="text-xs text-base-content/60 line-clamp-2">{review.text}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlacesSearch;

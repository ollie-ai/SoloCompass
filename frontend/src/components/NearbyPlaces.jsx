import { useState, useEffect, useCallback } from 'react';
import { MapPin, Utensils, Building2, CreditCard, Pill, Shield, Loader2, RefreshCw, ExternalLink } from 'lucide-react';
import api from '../lib/api';

const CATEGORIES = [
  { value: 'restaurant', label: 'Food', icon: Utensils, color: 'text-orange-500' },
  { value: 'hospital', label: 'Hospital', icon: Building2, color: 'text-red-500' },
  { value: 'atm', label: 'ATM', icon: CreditCard, color: 'text-blue-500' },
  { value: 'pharmacy', label: 'Pharmacy', icon: Pill, color: 'text-purple-500' },
  { value: 'police', label: 'Police', icon: Shield, color: 'text-indigo-500' },
  { value: 'embassy', label: 'Embassy', icon: Building2, color: 'text-cyan-500' },
];

const PlaceItem = ({ place }) => {
  const dist = place.distance != null
    ? place.distance < 1000
      ? `${Math.round(place.distance)}m`
      : `${(place.distance / 1000).toFixed(1)}km`
    : null;

  const mapsUrl = place.lat && place.lng
    ? `https://www.google.com/maps/search/?api=1&query=${place.lat},${place.lng}`
    : place.place_id
      ? `https://www.google.com/maps/place/?q=place_id:${place.place_id}`
      : null;

  return (
    <div className="flex items-start gap-3 p-3 rounded-xl bg-base-200/50 border border-base-300/40 hover:bg-base-200 transition-colors">
      <div className="w-8 h-8 rounded-lg bg-base-100 flex items-center justify-center shrink-0 shadow-sm">
        <MapPin size={14} className="text-brand-vibrant" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold text-base-content truncate">{place.name || place.display_name || 'Unnamed'}</p>
        {place.vicinity && (
          <p className="text-[11px] text-base-content/40 truncate mt-0.5">{place.vicinity}</p>
        )}
        {dist && <p className="text-[11px] text-base-content/50 mt-0.5">{dist} away</p>}
      </div>
      {mapsUrl && (
        <a href={mapsUrl} target="_blank" rel="noopener noreferrer"
          className="text-brand-vibrant hover:text-emerald-600 shrink-0">
          <ExternalLink size={13} />
        </a>
      )}
    </div>
  );
};

/**
 * NearbyPlaces component
 *
 * Props:
 *  - lat {number}  Required
 *  - lng {number}  Required
 *  - radius {number}  Default 2000m
 *  - className {string}
 */
const NearbyPlaces = ({ lat, lng, radius = 2000, className = '' }) => {
  const [activeCategory, setActiveCategory] = useState(CATEGORIES[0].value);
  const [places, setPlaces] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchPlaces = useCallback(async (category) => {
    if (!lat || !lng) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/places/nearby', {
        params: { lat, lng, type: category, radius }
      });
      setPlaces(res.data?.data || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load nearby places');
      setPlaces([]);
    } finally {
      setLoading(false);
    }
  }, [lat, lng, radius]);

  useEffect(() => {
    if (lat && lng) fetchPlaces(activeCategory);
  }, [lat, lng, activeCategory, fetchPlaces]);

  if (!lat || !lng) {
    return (
      <div className={`rounded-xl border border-base-300/60 bg-base-100 p-5 ${className}`}>
        <p className="text-xs text-base-content/40">Location coordinates required to show nearby places.</p>
      </div>
    );
  }

  const activeCat = CATEGORIES.find(c => c.value === activeCategory);

  return (
    <div className={`rounded-xl border border-base-300/60 bg-base-100 p-5 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-black text-base-content text-base flex items-center gap-2">
          <MapPin size={15} className="text-brand-vibrant" /> Nearby Places
        </h3>
        <button
          onClick={() => fetchPlaces(activeCategory)}
          disabled={loading}
          className="p-1.5 rounded-lg hover:bg-base-200 text-base-content/40 hover:text-base-content"
          title="Refresh"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Category tabs */}
      <div className="flex flex-wrap gap-2 mb-4">
        {CATEGORIES.map(({ value, label, icon: Icon, color }) => (
          <button
            key={value}
            onClick={() => setActiveCategory(value)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${
              activeCategory === value
                ? 'bg-brand-vibrant text-white border-brand-vibrant'
                : 'border-base-300 text-base-content/60 hover:border-brand-vibrant'
            }`}
          >
            <Icon size={11} className={activeCategory === value ? '' : color} />
            {label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 size={20} className="animate-spin text-brand-vibrant" />
        </div>
      )}

      {error && (
        <p className="text-xs text-error bg-error/10 p-3 rounded-xl">{error}</p>
      )}

      {!loading && !error && places.length === 0 && (
        <p className="text-xs text-base-content/40 text-center py-4">
          No {activeCat?.label.toLowerCase() || 'places'} found nearby.
        </p>
      )}

      {!loading && places.length > 0 && (
        <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
          {places.map((place, i) => (
            <PlaceItem key={place.place_id || place.id || i} place={place} />
          ))}
        </div>
      )}
    </div>
  );
};

export default NearbyPlaces;

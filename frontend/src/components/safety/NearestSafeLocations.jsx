import { useState, useEffect } from 'react';
import { Shield, Hospital, MapPin, Phone, Navigation, RefreshCw } from 'lucide-react';
import api from '../../lib/api';

const TYPE_CONFIG = {
  police: { label: 'Police', icon: Shield, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' },
  hospital: { label: 'Hospital', icon: Hospital, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' },
  clinic: { label: 'Clinic', icon: Hospital, color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200' },
  emergency: { label: 'Emergency', icon: Shield, color: 'text-error', bg: 'bg-error/10', border: 'border-error/30' }
};

function distanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function NearestSafeLocations({ lat, lng, onSelect }) {
  const [services, setServices] = useState({ hospitals: [], police: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [userLocation, setUserLocation] = useState(lat && lng ? { lat, lng } : null);

  useEffect(() => {
    if (lat && lng) {
      fetchServices(lat, lng);
    } else {
      requestLocation();
    }
  }, [lat, lng]);

  const requestLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserLocation(loc);
        fetchServices(loc.lat, loc.lng);
      },
      () => setError('Location access denied. Please enter coordinates manually.')
    );
  };

  const fetchServices = async (latitude, longitude) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/safety-areas/emergency-services/nearby?lat=${latitude}&lng=${longitude}&radius=10`);
      setServices({
        hospitals: res.data?.data?.hospitals || [],
        police: res.data?.data?.police || []
      });
    } catch {
      setError('Failed to load nearby services. Check your connection.');
    } finally {
      setLoading(false);
    }
  };

  const allServices = [
    ...services.police.map(s => ({ ...s, _type: 'police' })),
    ...services.hospitals.map(s => ({ ...s, _type: s.type || 'hospital' }))
  ].sort((a, b) => {
    if (!userLocation) return 0;
    const dA = distanceKm(userLocation.lat, userLocation.lng, a.lat, a.lon);
    const dB = distanceKm(userLocation.lat, userLocation.lng, b.lat, b.lon);
    return dA - dB;
  }).slice(0, 8);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-black text-base-content/70 uppercase tracking-wide">
          Nearby Emergency Services
        </p>
        {userLocation && (
          <button
            onClick={() => fetchServices(userLocation.lat, userLocation.lng)}
            disabled={loading}
            className="text-brand-vibrant text-xs font-bold flex items-center gap-1 hover:underline disabled:opacity-50"
          >
            <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        )}
      </div>

      {loading && (
        <div className="text-center py-4 text-base-content/60 text-sm">
          <div className="animate-spin w-5 h-5 border-2 border-brand-vibrant border-t-transparent rounded-full mx-auto mb-2" />
          Finding nearby services...
        </div>
      )}

      {error && (
        <p className="text-xs text-error p-3 bg-error/10 rounded-xl border border-error/30">{error}</p>
      )}

      {!loading && !error && allServices.length === 0 && (
        <p className="text-xs text-base-content/60 text-center py-4">
          No emergency services found nearby.
        </p>
      )}

      {allServices.map((service) => {
        const cfg = TYPE_CONFIG[service._type] || TYPE_CONFIG.emergency;
        const Icon = cfg.icon;
        const dist = userLocation
          ? distanceKm(userLocation.lat, userLocation.lng, service.lat, service.lon)
          : null;

        return (
          <div
            key={service.id}
            className={`rounded-xl border p-3 ${cfg.bg} ${cfg.border} cursor-pointer hover:opacity-90 transition-opacity`}
            onClick={() => onSelect?.(service)}
          >
            <div className="flex items-start gap-2">
              <Icon size={15} className={`${cfg.color} mt-0.5 shrink-0`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-black text-xs text-base-content truncate">{service.name}</p>
                  {dist !== null && (
                    <span className="text-[10px] text-base-content/50 shrink-0">{dist.toFixed(1)} km</span>
                  )}
                </div>
                {service.address && (
                  <p className="text-[10px] text-base-content/60 mt-0.5 flex items-center gap-0.5 truncate">
                    <MapPin size={9} /> {service.address}
                  </p>
                )}
                {service.phone && (
                  <a
                    href={`tel:${service.phone}`}
                    onClick={(e) => e.stopPropagation()}
                    className={`text-[10px] ${cfg.color} font-bold flex items-center gap-0.5 mt-0.5 hover:underline`}
                  >
                    <Phone size={9} /> {service.phone}
                  </a>
                )}
              </div>
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${service.lat},${service.lon}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className={`${cfg.color} hover:opacity-70 transition-opacity shrink-0`}
                title="Get directions"
              >
                <Navigation size={14} />
              </a>
            </div>
          </div>
        );
      })}
    </div>
  );
}

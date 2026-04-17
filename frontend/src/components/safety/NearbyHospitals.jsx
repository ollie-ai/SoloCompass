import { useState, useEffect } from 'react';
import { Hospital, MapPin, Phone, Navigation, RefreshCw } from 'lucide-react';
import api from '../../lib/api';

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

export default function NearbyHospitals({ lat, lng }) {
  const [hospitals, setHospitals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [userLoc, setUserLoc] = useState(lat && lng ? { lat, lng } : null);

  useEffect(() => {
    if (lat && lng) {
      fetchHospitals(lat, lng);
    } else {
      requestLocation();
    }
  }, [lat, lng]);

  const requestLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserLoc(loc);
        fetchHospitals(loc.lat, loc.lng);
      },
      () => {}
    );
  };

  const fetchHospitals = async (latitude, longitude) => {
    setLoading(true);
    try {
      const res = await api.get(`/safety-areas/hospitals/nearby?lat=${latitude}&lng=${longitude}&radius=10`);
      setHospitals(res.data?.data || []);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-base-content/60 py-3">
        <RefreshCw size={14} className="animate-spin" />
        Finding nearby hospitals...
      </div>
    );
  }

  if (hospitals.length === 0) {
    return (
      <div className="text-center py-4 text-base-content/60">
        <Hospital size={24} className="mx-auto mb-2 opacity-30" />
        <p className="text-sm">No hospitals found nearby</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {hospitals.map((h) => {
        const dist = userLoc ? distanceKm(userLoc.lat, userLoc.lng, h.lat, h.lon) : null;
        return (
          <div key={h.id} className="flex items-start gap-3 p-3 rounded-xl bg-red-50 border border-red-200">
            <Hospital size={15} className="text-red-600 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <p className="font-black text-xs text-base-content truncate">{h.name}</p>
                {dist !== null && (
                  <span className="text-[10px] text-base-content/50 shrink-0">{dist.toFixed(1)} km</span>
                )}
              </div>
              {h.address && (
                <p className="text-[10px] text-base-content/60 mt-0.5 flex items-center gap-0.5 truncate">
                  <MapPin size={9} /> {h.address}
                </p>
              )}
              {h.phone && (
                <a
                  href={`tel:${h.phone}`}
                  className="text-[10px] text-red-600 font-bold flex items-center gap-0.5 mt-0.5 hover:underline"
                >
                  <Phone size={9} /> {h.phone}
                </a>
              )}
            </div>
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${h.lat},${h.lon}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-red-600 hover:opacity-70 shrink-0"
              title="Directions"
            >
              <Navigation size={14} />
            </a>
          </div>
        );
      })}
    </div>
  );
}

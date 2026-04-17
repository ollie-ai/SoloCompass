import { useEffect, useRef } from 'react';
import { MapPin } from 'lucide-react';

const STATUS_COLORS = {
  want_to_visit: '#6366f1', // indigo
  planned: '#f59e0b',       // amber
  visited: '#10b981',       // emerald
  skipped: '#9ca3af',       // gray
};

const STATUS_LABELS = {
  want_to_visit: 'Want to Visit',
  planned: 'Planned',
  visited: 'Visited',
  skipped: 'Skipped',
};

function createMarkerHtml(color) {
  return `<div style="
    width: 28px; height: 28px;
    background: ${color};
    border: 3px solid white;
    border-radius: 50% 50% 50% 0;
    transform: rotate(-45deg);
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
  "></div>`;
}

export default function PlaceMap({ places }) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);

  const placesWithCoords = (places || []).filter(p => p.latitude && p.longitude);

  // Serialize places to string to detect any changes (coords, status, etc.)
  const placesKey = placesWithCoords.map(p => `${p.id}:${p.latitude}:${p.longitude}:${p.status}`).join('|');

  useEffect(() => {
    if (!mapContainerRef.current || placesWithCoords.length === 0) return;

    let L;
    let mounted = true;

    (async () => {
      try {
        L = (await import('leaflet')).default;

        // Leaflet CSS
        if (!document.querySelector('link[href*="leaflet.css"]')) {
          const link = document.createElement('link');
          link.rel = 'stylesheet';
          link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
          document.head.appendChild(link);
        }

        if (!mounted) return;

        if (mapRef.current) {
          mapRef.current.remove();
          mapRef.current = null;
        }

        const center = [
          placesWithCoords.reduce((s, p) => s + p.latitude, 0) / placesWithCoords.length,
          placesWithCoords.reduce((s, p) => s + p.longitude, 0) / placesWithCoords.length,
        ];

        const map = L.map(mapContainerRef.current, { zoomControl: true, scrollWheelZoom: false }).setView(center, 13);
        mapRef.current = map;

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap',
          maxZoom: 19,
        }).addTo(map);

        markersRef.current = [];
        for (const place of placesWithCoords) {
          const color = STATUS_COLORS[place.status] || STATUS_COLORS.want_to_visit;
          const icon = L.divIcon({
            html: createMarkerHtml(color),
            className: '',
            iconSize: [28, 28],
            iconAnchor: [14, 28],
            popupAnchor: [0, -30],
          });

          const marker = L.marker([place.latitude, place.longitude], { icon })
            .addTo(map)
            .bindPopup(`
              <div style="font-family: system-ui; min-width: 140px;">
                <p style="font-weight: 900; font-size: 14px; margin: 0 0 4px;">${place.name}</p>
                ${place.address ? `<p style="font-size: 12px; color: #666; margin: 0 0 4px;">${place.address}</p>` : ''}
                <span style="
                  display: inline-block; padding: 2px 8px; border-radius: 999px;
                  background: ${color}25; color: ${color};
                  font-size: 11px; font-weight: 700;
                ">${STATUS_LABELS[place.status] || place.status}</span>
                ${place.userRating ? `<p style="font-size: 12px; margin: 4px 0 0;">Rating: ${'⭐'.repeat(place.userRating)}</p>` : ''}
              </div>
            `);

          markersRef.current.push(marker);
        }

        if (placesWithCoords.length > 1) {
          const bounds = L.latLngBounds(placesWithCoords.map(p => [p.latitude, p.longitude]));
          map.fitBounds(bounds, { padding: [40, 40] });
        }
      } catch (err) {
        console.error('[PlaceMap] Error loading Leaflet:', err);
      }
    })();

    return () => {
      mounted = false;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [placesKey]);

  if (placesWithCoords.length === 0) {
    return (
      <div className="h-48 bg-base-200 rounded-xl flex flex-col items-center justify-center text-base-content/40">
        <MapPin size={28} className="mb-2 opacity-40" />
        <p className="text-sm font-bold">No places with location data</p>
        <p className="text-xs">Add places with coordinates to see them on the map</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Legend */}
      <div className="flex flex-wrap gap-3">
        {Object.entries(STATUS_LABELS).map(([status, label]) => (
          <div key={status} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full shrink-0" style={{ background: STATUS_COLORS[status] }} />
            <span className="text-xs text-base-content/60 font-bold">{label}</span>
          </div>
        ))}
      </div>
      {/* Map container */}
      <div
        ref={mapContainerRef}
        className="h-64 rounded-xl overflow-hidden border border-base-content/10"
      />
    </div>
  );
}

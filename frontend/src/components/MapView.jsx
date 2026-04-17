/**
 * MapView — Mapbox GL JS wrapper component.
 * Falls back to a placeholder when mapbox-gl is unavailable (not yet installed).
 *
 * Required env: VITE_MAPBOX_TOKEN
 *
 * Props:
 *  - center {[lng, lat]}  Default map centre
 *  - zoom {number}        Default zoom level
 *  - markers {Array}      [{id, lng, lat, label, color?}]
 *  - style {string}       Mapbox style URL; defaults to streets-v12
 *  - className {string}
 *  - height {string|number}
 *  - onMapLoad {fn}       Called with mapbox map instance once loaded
 */

import { useEffect, useRef, useState } from 'react';
import { MapPin, AlertTriangle } from 'lucide-react';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

const Fallback = ({ error }) => (
  <div className="flex flex-col items-center justify-center h-full w-full bg-base-200/50 rounded-xl border border-base-300 gap-3 p-6">
    {error ? (
      <>
        <AlertTriangle size={24} className="text-warning" />
        <p className="text-xs font-bold text-base-content/60 text-center max-w-xs">{error}</p>
      </>
    ) : (
      <>
        <MapPin size={24} className="text-brand-vibrant animate-pulse" />
        <p className="text-xs font-bold text-base-content/40">Loading map…</p>
      </>
    )}
  </div>
);

const MapView = ({
  center = [0, 20],
  zoom = 2,
  markers = [],
  style = 'mapbox://styles/mapbox/streets-v12',
  className = '',
  height = 360,
  onMapLoad
}) => {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const [error, setError] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mapboxgl;
    let map;
    let cancelled = false;

    (async () => {
      if (!MAPBOX_TOKEN) {
        setError('Mapbox access token not set (VITE_MAPBOX_TOKEN).');
        return;
      }

      try {
        mapboxgl = (await import('mapbox-gl')).default;
      } catch (e) {
        setError('Mapbox GL JS is not installed. Run: npm install mapbox-gl');
        return;
      }

      if (cancelled || !containerRef.current) return;

      mapboxgl.accessToken = MAPBOX_TOKEN;
      map = new mapboxgl.Map({
        container: containerRef.current,
        style,
        center,
        zoom,
        attributionControl: true,
      });

      mapRef.current = map;

      map.addControl(new mapboxgl.NavigationControl(), 'top-right');
      map.addControl(new mapboxgl.GeolocateControl({
        positionOptions: { enableHighAccuracy: true },
        trackUserLocation: false,
      }), 'top-right');

      map.on('load', () => {
        if (cancelled) return;
        setReady(true);
        onMapLoad?.(map);
      });
    })();

    return () => {
      cancelled = true;
      markersRef.current.forEach(m => m.remove?.());
      markersRef.current = [];
      if (map) map.remove();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Add / update markers when map is ready and markers prop changes
  useEffect(() => {
    if (!ready || !mapRef.current) return;

    let mapboxgl;
    (async () => {
      try {
        mapboxgl = (await import('mapbox-gl')).default;
      } catch {
        return;
      }

      // Remove old markers
      markersRef.current.forEach(m => m.remove?.());
      markersRef.current = [];

      for (const m of markers) {
        if (m.lng == null || m.lat == null) continue;
        const el = document.createElement('div');
        el.className = 'w-6 h-6 rounded-full border-2 border-white shadow-lg cursor-pointer';
        el.style.backgroundColor = m.color || '#10b981';

        const marker = new mapboxgl.Marker({ element: el })
          .setLngLat([m.lng, m.lat]);

        if (m.label) {
          marker.setPopup(new mapboxgl.Popup({ offset: 25 }).setText(m.label));
        }
        marker.addTo(mapRef.current);
        markersRef.current.push(marker);
      }
    })();
  }, [ready, markers]);

  const containerStyle = { height: typeof height === 'number' ? `${height}px` : height };

  return (
    <div className={`relative overflow-hidden rounded-xl ${className}`} style={containerStyle}>
      {error ? (
        <Fallback error={error} />
      ) : (
        <>
          {!ready && (
            <div className="absolute inset-0 z-10">
              <Fallback />
            </div>
          )}
          <div ref={containerRef} className="w-full h-full" />
        </>
      )}
    </div>
  );
};

export default MapView;

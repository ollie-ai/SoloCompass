import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import api from '../lib/api';

/**
 * SafetyHeatmapOverlay - Leaflet layer that shows safety risk heatmap
 * Used as a child component inside a <MapContainer> from react-leaflet
 */
const SafetyHeatmapOverlay = ({ country, lat, lng, radius, visible = true }) => {
  const map = useMap();
  const layerRef = useRef(null);

  useEffect(() => {
    if (!visible) {
      if (layerRef.current) {
        map.removeLayer(layerRef.current);
        layerRef.current = null;
      }
      return;
    }

    const fetchAndRender = async () => {
      try {
        const params = new URLSearchParams();
        if (country) params.set('country', country);
        if (lat) params.set('lat', lat);
        if (lng) params.set('lng', lng);
        if (radius) params.set('radius', radius);

        const res = await api.get(`/v1/maps/safety-overlay?${params}`);
        const points = res.data?.data?.points || [];

        if (layerRef.current) {
          map.removeLayer(layerRef.current);
        }

        const { default: L } = await import('leaflet');
        const markers = points.map(point => {
          const color = point.intensity < 0.3 ? '#22c55e' : point.intensity < 0.6 ? '#f59e0b' : '#ef4444';
          return L.circle([point.lat, point.lng], {
            color,
            fillColor: color,
            fillOpacity: 0.3 + point.intensity * 0.3,
            radius: 15000,
            weight: 1,
          }).bindTooltip(`${point.name}: ${point.safetyRating || 'Unknown'} risk`);
        });

        const group = L.layerGroup(markers);
        group.addTo(map);
        layerRef.current = group;
      } catch (err) {
        console.warn('[SafetyHeatmap] Failed to load overlay:', err.message);
      }
    };

    fetchAndRender();

    return () => {
      if (layerRef.current) {
        map.removeLayer(layerRef.current);
        layerRef.current = null;
      }
    };
  }, [map, visible, country, lat, lng, radius]);

  return null;
};

export default SafetyHeatmapOverlay;

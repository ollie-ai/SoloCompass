import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';

/**
 * MapCluster — Leaflet marker clustering via useMap.
 *
 * Wraps `leaflet.markercluster` to add clustered markers to the parent
 * <MapContainer>. Must be rendered as a child of <MapContainer>.
 *
 * Props:
 *   markers  – Array of { id, lat, lng, popup?: string, icon?: L.Icon }
 *   options  – Optional leaflet.markercluster ClusterOptions overrides
 *   onMarkerClick – Optional callback (marker) => void
 */
export default function MapCluster({ markers = [], options = {}, onMarkerClick }) {
  const map = useMap();
  const clusterGroupRef = useRef(null);

  useEffect(() => {
    // Lazy-load leaflet.markercluster CSS + JS so the main bundle isn't bloated
    const loadCluster = async () => {
      try {
        await import('leaflet.markercluster/dist/MarkerCluster.css');
        await import('leaflet.markercluster/dist/MarkerCluster.Default.css');
        await import('leaflet.markercluster');
      } catch {
        // library may already be loaded — ignore
      }

      if (!L.markerClusterGroup) return;

      // Remove previous cluster group if it exists
      if (clusterGroupRef.current) {
        map.removeLayer(clusterGroupRef.current);
      }

      const clusterGroup = L.markerClusterGroup({
        maxClusterRadius: 60,
        spiderfyOnMaxZoom: true,
        showCoverageOnHover: false,
        zoomToBoundsOnClick: true,
        ...options,
      });

      markers.forEach((m) => {
        if (m.lat == null || m.lng == null) return;
        const marker = L.marker([m.lat, m.lng], { icon: m.icon });
        if (m.popup) {
          marker.bindPopup(m.popup);
        }
        if (onMarkerClick) {
          marker.on('click', () => onMarkerClick(m));
        }
        clusterGroup.addLayer(marker);
      });

      map.addLayer(clusterGroup);
      clusterGroupRef.current = clusterGroup;
    };

    if (markers.length > 0) {
      loadCluster();
    }

    return () => {
      if (clusterGroupRef.current) {
        map.removeLayer(clusterGroupRef.current);
        clusterGroupRef.current = null;
      }
    };
  }, [map, markers, options, onMarkerClick]);

  return null;
}

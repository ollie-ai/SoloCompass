import { useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import L from 'leaflet';
import { useMap } from 'react-leaflet';

// ─── Cluster icon factory ─────────────────────────────────────────────────────
function createClusterIcon(count, color = '#10b981') {
  const size = count < 10 ? 36 : count < 100 ? 42 : 50;
  return L.divIcon({
    className: 'sc-cluster-icon',
    html: `
      <div style="
        width:${size}px;height:${size}px;
        background:${color};
        border:2.5px solid white;
        border-radius:50%;
        display:flex;align-items:center;justify-content:center;
        color:white;font-weight:900;font-size:${size < 42 ? 11 : 13}px;
        box-shadow:0 2px 10px ${color}55;
      ">${count}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

/**
 * MapCluster — lightweight client-side marker clustering without extra packages.
 *
 * Groups an array of `{ position, ...markerProps }` into visual clusters based
 * on a configurable pixel radius. Zoom in to expand clusters to individual pins.
 *
 * Must be rendered inside a `<MapContainer>`.
 *
 * @example
 * <MapCluster
 *   markers={[
 *     { position: [48.8, 2.3], popup: 'Paris', color: '#ef4444' },
 *     { position: [51.5, -0.1], popup: 'London' },
 *   ]}
 *   clusterRadius={60}
 *   color="#10b981"
 * />
 */
const MapCluster = ({
  markers = [],
  clusterRadius = 60,
  color = '#10b981',
  markerSize = 28,
  onMarkerClick,
}) => {
  const map = useMap();
  const layerRef = useRef(null);

  useEffect(() => {
    if (!map || !markers.length) return;

    function buildClusters() {
      // Remove previous layer
      if (layerRef.current) {
        layerRef.current.clearLayers();
      } else {
        layerRef.current = L.layerGroup().addTo(map);
      }

      // Project all markers to pixel space at current zoom
      const zoom = map.getZoom();
      const projected = markers.map((m, idx) => ({
        ...m,
        idx,
        px: map.project(m.position, zoom),
        clustered: false,
      }));

      const clusters = [];
      for (let i = 0; i < projected.length; i++) {
        if (projected[i].clustered) continue;
        const cluster = { points: [projected[i]], center: projected[i].px };
        projected[i].clustered = true;
        for (let j = i + 1; j < projected.length; j++) {
          if (projected[j].clustered) continue;
          const dx = projected[j].px.x - cluster.center.x;
          const dy = projected[j].px.y - cluster.center.y;
          if (Math.sqrt(dx * dx + dy * dy) < clusterRadius) {
            cluster.points.push(projected[j]);
            projected[j].clustered = true;
            // Recalculate cluster center (centroid)
            cluster.center = {
              x: cluster.points.reduce((s, p) => s + p.px.x, 0) / cluster.points.length,
              y: cluster.points.reduce((s, p) => s + p.px.y, 0) / cluster.points.length,
            };
          }
        }
        clusters.push(cluster);
      }

      for (const cluster of clusters) {
        const latlng = map.unproject(cluster.center, zoom);

        if (cluster.points.length === 1) {
          const m = cluster.points[0];
          // Single marker
          const icon = L.divIcon({
            className: 'sc-map-marker',
            html: `<div style="
              width:${markerSize}px;height:${markerSize}px;
              background:${m.color || color};
              border:2px solid white;
              border-radius:50% 50% 50% 0;
              transform:rotate(-45deg);
              box-shadow:0 2px 6px rgba(0,0,0,0.2);
            "><div style="
              width:${Math.round(markerSize * 0.3)}px;height:${Math.round(markerSize * 0.3)}px;
              background:white;border-radius:50%;
              position:absolute;top:50%;left:50%;
              transform:translate(-50%,-50%) rotate(45deg);
            "></div></div>`,
            iconSize:    [markerSize, markerSize],
            iconAnchor:  [markerSize / 2, markerSize],
            popupAnchor: [0, -markerSize],
          });
          const marker = L.marker(m.position, { icon }).addTo(layerRef.current);
          if (m.popup) marker.bindPopup(String(m.popup));
          if (m.tooltip) marker.bindTooltip(String(m.tooltip));
          if (onMarkerClick) marker.on('click', () => onMarkerClick(m));
        } else {
          // Cluster bubble — click zooms in
          const clusterMarker = L.marker(latlng, {
            icon: createClusterIcon(cluster.points.length, color),
          }).addTo(layerRef.current);
          clusterMarker.on('click', () => {
            map.setView(latlng, map.getZoom() + 2, { animate: true });
          });
          clusterMarker.bindTooltip(`${cluster.points.length} locations — click to expand`, {
            direction: 'top',
            offset: [0, -8],
          });
        }
      }
    }

    buildClusters();
    map.on('zoomend moveend', buildClusters);

    return () => {
      map.off('zoomend moveend', buildClusters);
      if (layerRef.current) {
        layerRef.current.clearLayers();
        layerRef.current.remove();
        layerRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, markers, clusterRadius, color, markerSize]);

  return null;
};

MapCluster.propTypes = {
  markers: PropTypes.arrayOf(
    PropTypes.shape({
      position: PropTypes.arrayOf(PropTypes.number).isRequired,
      popup:    PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
      tooltip:  PropTypes.string,
      color:    PropTypes.string,
    })
  ),
  clusterRadius: PropTypes.number,
  color:         PropTypes.string,
  markerSize:    PropTypes.number,
  onMarkerClick: PropTypes.func,
};

export default MapCluster;

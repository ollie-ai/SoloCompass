import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';

const CLUSTER_RADIUS_PX = 40;

function latLngToPoint(map, lat, lng) {
  return map.latLngToContainerPoint([lat, lng]);
}

function buildClusters(map, markers) {
  const clusters = [];
  const assigned = new Set();

  markers.forEach((marker, i) => {
    if (assigned.has(i)) return;
    const pt = latLngToPoint(map, marker.lat, marker.lng);
    const cluster = { members: [marker], center: { lat: marker.lat, lng: marker.lng }, pt };
    assigned.add(i);

    markers.forEach((other, j) => {
      if (i === j || assigned.has(j)) return;
      const otherPt = latLngToPoint(map, other.lat, other.lng);
      const dx = pt.x - otherPt.x;
      const dy = pt.y - otherPt.y;
      if (Math.sqrt(dx * dx + dy * dy) < CLUSTER_RADIUS_PX) {
        cluster.members.push(other);
        assigned.add(j);
      }
    });

    clusters.push(cluster);
  });

  return clusters;
}

/**
 * MapCluster — renders markers on a Leaflet map and clusters nearby ones.
 * Must be used inside a <MapContainer>.
 *
 * Props:
 *   markers: Array<{ lat, lng, popup?, id? }>
 *   clusterColor: string (default '#10b981')
 */
export default function MapCluster({ markers = [], clusterColor = '#10b981' }) {
  const map = useMap();
  const layerRef = useRef(null);

  useEffect(() => {
    if (!map || !markers.length) return;

    const render = () => {
      if (layerRef.current) {
        map.removeLayer(layerRef.current);
      }

      const group = L.layerGroup();
      const clusters = buildClusters(map, markers);

      clusters.forEach(({ members, center }) => {
        if (members.length === 1) {
          const m = members[0];
          const icon = L.divIcon({
            className: '',
            html: `<div style="width:14px;height:14px;background:${clusterColor};border:2px solid white;border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,.3)"></div>`,
            iconSize: [14, 14],
            iconAnchor: [7, 7],
          });
          const marker = L.marker([m.lat, m.lng], { icon });
          if (m.popup) marker.bindPopup(m.popup);
          group.addLayer(marker);
        } else {
          const size = Math.min(36, 20 + members.length * 2);
          const icon = L.divIcon({
            className: '',
            html: `<div style="width:${size}px;height:${size}px;background:${clusterColor};border:2px solid white;border-radius:50%;box-shadow:0 1px 6px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;color:white;font-size:11px;font-weight:700">${members.length}</div>`,
            iconSize: [size, size],
            iconAnchor: [size / 2, size / 2],
          });
          L.marker([center.lat, center.lng], { icon }).addTo(group);
        }
      });

      group.addTo(map);
      layerRef.current = group;
    };

    render();
    map.on('zoomend moveend', render);

    return () => {
      map.off('zoomend moveend', render);
      if (layerRef.current) map.removeLayer(layerRef.current);
    };
  }, [map, markers, clusterColor]);

  return null;
}

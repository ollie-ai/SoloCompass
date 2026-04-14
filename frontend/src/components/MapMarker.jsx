import { useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import L from 'leaflet';
import { useMap } from 'react-leaflet';

/**
 * Create a SoloCompass-branded Leaflet div-icon.
 */
export function createMarkerIcon({
  color = '#10b981',
  size = 32,
  label = null,
  pulse = false,
} = {}) {
  const pulseHtml = pulse
    ? `<div style="
        position:absolute;top:50%;left:50%;
        transform:translate(-50%,-50%);
        width:${size * 1.8}px;height:${size * 1.8}px;
        border-radius:50%;
        background:${color}33;
        animation:mapPulse 1.8s ease-out infinite;
      "></div>`
    : '';

  const labelHtml = label
    ? `<div style="
        position:absolute;top:50%;left:50%;
        transform:translate(-50%,-50%) rotate(45deg);
        font-size:9px;font-weight:900;color:#fff;
        white-space:nowrap;
      ">${label}</div>`
    : '';

  return L.divIcon({
    className: 'sc-map-marker',
    html: `
      <div style="position:relative;width:${size}px;height:${size}px;">
        ${pulseHtml}
        <div style="
          width:${size}px;height:${size}px;
          background:${color};
          border:2.5px solid white;
          border-radius:50% 50% 50% 0;
          transform:rotate(-45deg);
          box-shadow:0 2px 8px rgba(0,0,0,0.25);
          position:relative;z-index:1;
        ">
          <div style="
            width:${Math.round(size * 0.31)}px;height:${Math.round(size * 0.31)}px;
            background:white;border-radius:50%;
            position:absolute;top:50%;left:50%;
            transform:translate(-50%,-50%) rotate(45deg);
            opacity:0.9;
          "></div>
          ${labelHtml}
        </div>
      </div>`,
    iconSize:    [size, size],
    iconAnchor:  [size / 2, size],
    popupAnchor: [0, -size],
  });
}

// Inject keyframe animation once
if (typeof document !== 'undefined' && !document.getElementById('sc-marker-style')) {
  const style = document.createElement('style');
  style.id = 'sc-marker-style';
  style.textContent = `
    @keyframes mapPulse {
      0%   { transform:translate(-50%,-50%) scale(0.5); opacity:0.8; }
      70%  { transform:translate(-50%,-50%) scale(1.4); opacity:0; }
      100% { transform:translate(-50%,-50%) scale(1.4); opacity:0; }
    }
    .sc-map-marker { background:transparent!important; border:none!important; }
  `;
  document.head.appendChild(style);
}

/**
 * MapMarker — a react-leaflet-compatible imperative marker.
 *
 * Must be rendered inside a `<MapContainer>`.
 *
 * @example
 * <MapMarker
 *   position={[51.5, -0.1]}
 *   color="#ef4444"
 *   label="!"
 *   pulse
 *   popup={<p>Central London</p>}
 * />
 */
const MapMarker = ({
  position,
  color = '#10b981',
  size = 32,
  label = null,
  pulse = false,
  popup = null,
  tooltip = null,
  onClick,
  zIndexOffset = 0,
}) => {
  const map = useMap();
  const markerRef = useRef(null);

  useEffect(() => {
    if (!position || !map) return;

    const icon = createMarkerIcon({ color, size, label, pulse });
    const marker = L.marker(position, { icon, zIndexOffset }).addTo(map);

    if (popup) {
      const container = document.createElement('div');
      // Render popup content as a string when it's a string, otherwise keep as DOM
      if (typeof popup === 'string') {
        container.innerHTML = popup;
      }
      marker.bindPopup(typeof popup === 'string' ? popup : '<div id="sc-popup-portal"></div>');
    }

    if (tooltip) {
      marker.bindTooltip(typeof tooltip === 'string' ? tooltip : String(tooltip), { permanent: false });
    }

    if (onClick) {
      marker.on('click', onClick);
    }

    markerRef.current = marker;

    return () => {
      marker.remove();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, position?.[0], position?.[1], color, size, label, pulse, zIndexOffset]);

  return null;
};

MapMarker.propTypes = {
  position:     PropTypes.arrayOf(PropTypes.number).isRequired,
  color:        PropTypes.string,
  size:         PropTypes.number,
  label:        PropTypes.string,
  pulse:        PropTypes.bool,
  popup:        PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
  tooltip:      PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
  onClick:      PropTypes.func,
  zIndexOffset: PropTypes.number,
};

export default MapMarker;

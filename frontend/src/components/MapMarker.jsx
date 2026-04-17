import { Marker, Popup } from 'react-leaflet';
import L from 'leaflet';

export const createCustomIcon = (color = '#10b981') =>
  L.divIcon({
    className: 'custom-marker',
    html: `
      <div style="
        width: 32px;
        height: 32px;
        background: ${color};
        border: 3px solid white;
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <div style="
          width: 10px;
          height: 10px;
          background: white;
          border-radius: 50%;
          transform: rotate(45deg);
        "></div>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  });

const ICONS = {
  default: createCustomIcon('#10b981'),
  active: createCustomIcon('#3b82f6'),
  user: createCustomIcon('#f97316'),
};

export function getMarkerIcon(type) {
  return ICONS[type] || ICONS.default;
}

/**
 * MapMarker — a typed Leaflet marker with an optional popup.
 *
 * Props:
 *  marker  — { id?, position|latlng, type?, title?, description?, link?, popup? }
 *  selected — boolean
 *  onClick  — (marker) => void
 */
export default function MapMarker({ marker, selected = false, onClick }) {
  const icon =
    marker.type === 'active'
      ? ICONS.active
      : marker.type === 'user'
      ? ICONS.user
      : selected
      ? ICONS.active
      : ICONS.default;

  return (
    <Marker
      position={marker.position || marker.latlng}
      icon={icon}
      eventHandlers={{ click: () => onClick?.(marker) }}
    >
      {marker.popup && (
        <Popup>
          <div className="min-w-[150px]">
            <h3 className="font-bold text-sm">{marker.title}</h3>
            {marker.description && (
              <p className="text-xs text-base-content/80 mt-1">{marker.description}</p>
            )}
            {marker.link && (
              <a href={marker.link} className="text-xs text-blue-600 hover:underline mt-1 block">
                See location details →
              </a>
            )}
          </div>
        </Popup>
      )}
    </Marker>
  );
}

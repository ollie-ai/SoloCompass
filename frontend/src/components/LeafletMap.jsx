import { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import MapControls from './MapControls';
import MapMarker, { createCustomIcon } from './MapMarker';

const DEFAULT_CENTER = [51.505, -0.09];
const DEFAULT_ZOOM = 13;
const LAYER_URLS = {
  street: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  terrain: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
  dark: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
};


function MapController({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.setView(center, zoom || map.getZoom());
    }
  }, [center, zoom, map]);
  return null;
}

function LocationMarker({ position, setPosition }) {
  useMapEvents({
    click(e) {
      if (setPosition) {
        setPosition([e.latlng.lat, e.latlng.lng]);
      }
    },
  });

  return position ? <MapMarker marker={{ position, type: 'user' }} /> : null;
}

export default function LeafletMap({
  center,
  zoom = DEFAULT_ZOOM,
  markers = [],
  selectedMarker = null,
  onMarkerClick = () => {},
  onMapClick = null,
  height = '400px',
  interactive = true,
  showZoomControls = true,
  showMapControls = true,
  className = '',
}) {
  const mapRef = useRef(null);
  const [mapCenter, setMapCenter] = useState(center || DEFAULT_CENTER);
  const [activeLayer, setActiveLayer] = useState('street');

  useEffect(() => {
    if (center && Array.isArray(center) && center.length === 2) {
      setMapCenter(center);
    }
  }, [center]);

  return (
    <div className={`rounded-xl overflow-hidden border border-base-300 ${className}`} style={{ height }}>
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <MapContainer
        center={mapCenter}
        zoom={zoom}
        ref={mapRef}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={interactive}
        dragging={interactive}
        zoomControl={showZoomControls && !showMapControls}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url={LAYER_URLS[activeLayer] || LAYER_URLS.street}
        />
        {showMapControls && <MapControls activeLayer={activeLayer} onLayerChange={setActiveLayer} />}
        
        {onMapClick && (
          <MapClickHandler onClick={onMapClick} />
        )}
        
        <MapController center={mapCenter} zoom={zoom} />
        
        {markers.map((marker, index) => (
          <MapMarker
            key={marker.id || index}
            marker={marker}
            selected={marker.id === selectedMarker?.id}
            onClick={onMarkerClick}
          />
        ))}
      </MapContainer>
    </div>
  );
}

function MapClickHandler({ onClick }) {
  useMapEvents({
    click: onClick,
  });
  return null;
}

export { createCustomIcon };

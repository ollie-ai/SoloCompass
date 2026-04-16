import { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, Calendar, Clock, Navigation } from 'lucide-react';
import { geocoding } from '../services/geocoding';

const DAY_COLORS = [
  '#10b981', // emerald
  '#3b82f6', // blue
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#f97316', // orange
  '#14b8a6', // teal
  '#6366f1', // indigo
];

function createNumberedIcon(number, color = '#10b981') {
  return L.divIcon({
    className: 'numbered-marker',
    html: `
      <div style="
        width: 32px;
        height: 32px;
        background: ${color};
        border: 3px solid white;
        border-radius: 50%;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: 900;
        font-size: 13px;
        font-family: system-ui, -apple-system, sans-serif;
      ">${number}</div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -18],
  });
}

function FitBounds({ positions }) {
  const map = useMap();
  useEffect(() => {
    if (positions.length > 0) {
      const bounds = L.latLngBounds(positions);
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
    }
  }, [positions, map]);
  return null;
}

export default function TripMap({ trip, className = '' }) {
  const [markers, setMarkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState(null);
  const [error, setError] = useState(null);

  const itinerary = trip?.itinerary || [];

  useEffect(() => {
    if (itinerary.length === 0) {
      setLoading(false);
      return;
    }
    geocodeActivities();
  }, [itinerary]);

  const geocodeActivities = async () => {
    setLoading(true);
    setError(null);
    const results = [];
    let activityCounter = 0;

    for (const day of itinerary) {
      const dayIndex = (day.day_number || 1) - 1;
      const color = DAY_COLORS[dayIndex % DAY_COLORS.length];

      for (const activity of (day.activities || [])) {
        activityCounter++;
        const searchQuery = activity.location
          ? `${activity.name} ${activity.location}`
          : `${activity.name} ${trip?.destination || ''}`;

        try {
          const result = await geocoding.geocodeAddress(searchQuery);
          if (result.success) {
            results.push({
              id: activity.id || `${day.id}-${activityCounter}`,
              position: [result.data.lat, result.data.lon],
              number: activityCounter,
              dayNumber: day.day_number || dayIndex + 1,
              dayColor: color,
              name: activity.name,
              type: activity.type,
              time: activity.time,
              location: activity.location,
              cost: activity.cost,
              description: activity.description,
              date: day.date,
            });
          }
        } catch {
          // Skip activities that can't be geocoded
        }
      }
    }

    if (results.length === 0 && itinerary.length > 0) {
      // Fallback: geocode just the destination
      try {
        const destResult = await geocoding.geocodeAddress(trip?.destination || '');
        if (destResult.success) {
          results.push({
            id: 'destination',
            position: [destResult.data.lat, destResult.data.lon],
            number: 1,
            dayNumber: 1,
            dayColor: DAY_COLORS[0],
            name: trip?.destination || 'Destination',
            type: 'destination',
            time: '',
            location: destResult.data.formatted,
          });
        }
      } catch {
        setError('Could not locate activities on the map');
      }
    }

    setMarkers(results);
    setLoading(false);
  };

  const filteredMarkers = useMemo(() => {
    if (selectedDay === null) return markers;
    return markers.filter(m => m.dayNumber === selectedDay);
  }, [markers, selectedDay]);

  const routeLines = useMemo(() => {
    const lines = [];
    const dayGroups = {};

    const source = selectedDay === null ? markers : filteredMarkers;
    for (const m of source) {
      if (!dayGroups[m.dayNumber]) dayGroups[m.dayNumber] = [];
      dayGroups[m.dayNumber].push(m);
    }

    for (const [dayNum, dayMarkers] of Object.entries(dayGroups)) {
      if (dayMarkers.length >= 2) {
        const dayIndex = (parseInt(dayNum) || 1) - 1;
        lines.push({
          positions: dayMarkers.map(m => m.position),
          color: DAY_COLORS[dayIndex % DAY_COLORS.length],
          dayNumber: parseInt(dayNum),
        });
      }
    }

    return lines;
  }, [markers, filteredMarkers, selectedDay]);

  const allPositions = filteredMarkers.map(m => m.position);

  const uniqueDays = useMemo(() => {
    const days = [...new Set(markers.map(m => m.dayNumber))].sort((a, b) => a - b);
    return days;
  }, [markers]);

  if (loading) {
    return (
      <div className={`bg-base-200 rounded-xl animate-pulse ${className}`} style={{ height: '400px' }}>
        <div className="flex items-center justify-center h-full gap-3">
          <div className="w-5 h-5 border-2 border-brand-vibrant border-t-transparent rounded-full animate-spin" />
          <span className="text-base-content/40 font-bold text-sm">Mapping activities...</span>
        </div>
      </div>
    );
  }

  if (error || markers.length === 0) {
    return (
      <div className={`bg-base-200 rounded-xl ${className}`} style={{ height: '200px' }}>
        <div className="flex flex-col items-center justify-center h-full text-base-content/40">
          <MapPin size={32} className="mb-2" />
          <p className="font-bold text-sm">{error || 'No mappable activities found'}</p>
          <p className="text-xs mt-1">Activities need location data to appear on the map</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-xl overflow-hidden border border-base-300 ${className}`}>
      {/* Day filter tabs */}
      {uniqueDays.length > 1 && (
        <div className="bg-base-100 border-b border-base-300 px-4 py-2 flex items-center gap-2 overflow-x-auto">
          <button
            onClick={() => setSelectedDay(null)}
            className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap ${
              selectedDay === null
                ? 'bg-brand-vibrant text-white shadow-sm'
                : 'bg-base-200 text-base-content/60 hover:bg-base-300'
            }`}
          >
            All Days
          </button>
          {uniqueDays.map(dayNum => {
            const dayIndex = (dayNum || 1) - 1;
            const color = DAY_COLORS[dayIndex % DAY_COLORS.length];
            return (
              <button
                key={dayNum}
                onClick={() => setSelectedDay(dayNum === selectedDay ? null : dayNum)}
                className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap flex items-center gap-1.5 ${
                  selectedDay === dayNum
                    ? 'text-white shadow-sm'
                    : 'bg-base-200 text-base-content/60 hover:bg-base-300'
                }`}
                style={selectedDay === dayNum ? { backgroundColor: color } : {}}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: color }}
                />
                Day {dayNum}
              </button>
            );
          })}
        </div>
      )}

      {/* Map */}
      <div style={{ height: '400px' }}>
        <MapContainer
          center={allPositions[0] || [51.505, -0.09]}
          zoom={13}
          style={{ height: '100%', width: '100%' }}
          scrollWheelZoom={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {allPositions.length > 0 && <FitBounds positions={allPositions} />}

          {/* Route polylines */}
          {routeLines.map(line => (
            <Polyline
              key={`route-${line.dayNumber}`}
              positions={line.positions}
              pathOptions={{
                color: line.color,
                weight: 3,
                opacity: 0.6,
                dashArray: '8 6',
              }}
            />
          ))}

          {/* Activity markers */}
          {filteredMarkers.map(marker => (
            <Marker
              key={marker.id}
              position={marker.position}
              icon={createNumberedIcon(marker.number, marker.dayColor)}
            >
              <Popup>
                <div className="min-w-[180px] max-w-[240px]">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-black flex-shrink-0"
                      style={{ backgroundColor: marker.dayColor }}
                    >
                      {marker.number}
                    </span>
                    <h3 className="font-bold text-sm leading-tight">{marker.name}</h3>
                  </div>
                  <div className="text-xs text-gray-500 space-y-0.5 mt-1">
                    <p className="flex items-center gap-1">
                      <Calendar size={10} />
                      Day {marker.dayNumber}
                      {marker.date && ` — ${new Date(marker.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`}
                    </p>
                    {marker.time && (
                      <p className="flex items-center gap-1">
                        <Clock size={10} />
                        {marker.time}
                      </p>
                    )}
                    {marker.location && (
                      <p className="flex items-center gap-1">
                        <MapPin size={10} />
                        {marker.location}
                      </p>
                    )}
                    {marker.type && (
                      <span className="inline-block px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 text-[10px] font-bold mt-1">
                        {marker.type}
                      </span>
                    )}
                  </div>
                  {marker.description && (
                    <p className="text-xs text-gray-400 mt-1.5 line-clamp-2">{marker.description}</p>
                  )}
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(marker.name + ' ' + (marker.location || ''))}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 text-xs text-blue-600 font-bold mt-2 hover:underline"
                  >
                    <Navigation size={10} /> Get Directions
                  </a>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      {/* Legend */}
      <div className="bg-base-100 border-t border-base-300 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-3 overflow-x-auto">
          {uniqueDays.map(dayNum => {
            const dayIndex = (dayNum || 1) - 1;
            const color = DAY_COLORS[dayIndex % DAY_COLORS.length];
            const count = markers.filter(m => m.dayNumber === dayNum).length;
            return (
              <div key={dayNum} className="flex items-center gap-1.5 text-[10px] font-bold text-base-content/60 whitespace-nowrap">
                <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                Day {dayNum} ({count})
              </div>
            );
          })}
        </div>
        <p className="text-[10px] font-bold text-base-content/40 whitespace-nowrap ml-4">
          {filteredMarkers.length} locations mapped
        </p>
      </div>
    </div>
  );
}

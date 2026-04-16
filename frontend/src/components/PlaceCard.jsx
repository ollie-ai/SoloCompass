import { CheckCircle2, MapPin, Star, Trash2, Bookmark } from 'lucide-react';

const toRad = (deg) => (deg * Math.PI) / 180;

const haversineKm = (from, to) => {
  const earthRadiusKm = 6371;
  const dLat = toRad(to.lat - from.lat);
  const dLon = toRad(to.lng - from.lng);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(from.lat)) * Math.cos(toRad(to.lat)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
};

const PlaceCard = ({ place, onToggleVisited, onDelete, userLocation }) => {
  const rating = Number(place?.rating ?? place?.externalRating ?? place?.overallRating ?? 0);
  const hasCoords = Number.isFinite(Number(place?.latitude)) && Number.isFinite(Number(place?.longitude));
  const hasUserCoords = Number.isFinite(Number(userLocation?.lat)) && Number.isFinite(Number(userLocation?.lng));
  const distanceKm = hasCoords && hasUserCoords
    ? haversineKm(
      { lat: Number(userLocation.lat), lng: Number(userLocation.lng) },
      { lat: Number(place.latitude), lng: Number(place.longitude) }
    )
    : null;

  return (
    <div className="glass-card p-6 rounded-xl border border-base-content/5 hover:shadow-lg transition-all">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <button
            onClick={onToggleVisited}
            className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${place.visited ? 'bg-success/20 text-success' : 'bg-violet-50 text-violet-600 hover:bg-violet-100'}`}
          >
            {place.visited ? <CheckCircle2 size={24} /> : <Bookmark size={18} />}
          </button>
          <div>
            <h4 className={`text-lg font-black ${place.visited ? 'text-base-content/40 line-through' : 'text-base-content'}`}>{place.name}</h4>
            {place.address && (
              <p className="text-sm text-base-content/40 font-medium flex items-center gap-1 mt-1">
                <MapPin size={14} /> {place.address}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md bg-violet-100 text-violet-700">{place.category}</span>
              {place.visited && <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md bg-success/20 text-success">Visited</span>}
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-base-200 text-base-content/70">
                {distanceKm != null ? `${distanceKm.toFixed(1)} km away` : 'Distance unavailable'}
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-700 flex items-center gap-1">
                <Star size={10} className={rating > 0 ? 'fill-amber-500 text-amber-500' : ''} />
                {rating > 0 ? `${rating.toFixed(1)}/5` : 'No rating'}
              </span>
            </div>
          </div>
        </div>
        <button onClick={onDelete} className="p-2 text-base-content/20 hover:text-error hover:bg-error/10 rounded-lg transition-all">
          <Trash2 size={18} />
        </button>
      </div>
      {place.notes && (
        <div className="mt-4 pt-4 border-t border-base-content/5">
          <p className="text-sm text-base-content/60 font-medium">{place.notes}</p>
        </div>
      )}
    </div>
  );
};

export default PlaceCard;

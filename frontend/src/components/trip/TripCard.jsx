import { Link } from 'react-router-dom';
import { MapPin, Calendar, ChevronRight } from 'lucide-react';
import TripStatusBadge from './TripStatusBadge';

export default function TripCard({ trip, actions }) {
  const startDate = trip.start_date
    ? new Date(trip.start_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    : null;
  const endDate = trip.end_date
    ? new Date(trip.end_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    : null;

  return (
    <div className="group bg-base-100 rounded-xl border border-base-content/10 overflow-hidden hover:shadow-md hover:border-brand-vibrant/30 transition-all duration-200">
      {/* Cover image */}
      {trip.cover_image && (
        <div className="h-32 overflow-hidden">
          <img src={trip.cover_image} alt={trip.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        </div>
      )}
      {!trip.cover_image && (
        <div className="h-24 bg-gradient-to-br from-brand-vibrant/20 to-brand-accent/20 flex items-center justify-center">
          <MapPin size={28} className="text-brand-vibrant/40" />
        </div>
      )}

      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <Link
            to={`/trips/${trip.id}`}
            className="flex-1 min-w-0"
          >
            <h3 className="font-black text-base-content truncate group-hover:text-brand-vibrant transition-colors">
              {trip.name}
            </h3>
          </Link>
          <TripStatusBadge status={trip.status} />
        </div>

        {trip.destination && (
          <p className="text-sm text-base-content/60 flex items-center gap-1 mb-2 truncate">
            <MapPin size={12} className="shrink-0" />
            {trip.destination}
          </p>
        )}

        {(startDate || endDate) && (
          <p className="text-xs text-base-content/40 flex items-center gap-1 mb-3">
            <Calendar size={11} className="shrink-0" />
            {startDate && endDate ? `${startDate} – ${endDate}` : startDate || endDate}
          </p>
        )}

        <div className="flex items-center justify-between">
          <Link
            to={`/trips/${trip.id}`}
            className="text-xs font-bold text-brand-vibrant hover:text-brand-vibrant/80 flex items-center gap-1 transition-colors"
          >
            View Trip <ChevronRight size={12} />
          </Link>
          {actions}
        </div>
      </div>
    </div>
  );
}

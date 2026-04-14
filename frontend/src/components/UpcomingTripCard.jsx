import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import { Calendar, MapPin, Clock, ArrowRight, Plane } from 'lucide-react';

/**
 * UpcomingTripCard — summary card for a trip that hasn't started yet.
 *
 * Displays destination, date range, a countdown to departure, and a status
 * badge. Designed for use in dashboards, trip lists, and the sidebar.
 *
 * @example
 * <UpcomingTripCard trip={trip} />
 */
const UpcomingTripCard = ({ trip, className = '' }) => {
  if (!trip) return null;

  const startDate = trip.start_date ? new Date(trip.start_date) : null;
  const endDate   = trip.end_date   ? new Date(trip.end_date)   : null;

  const formatDate = (d) =>
    d ? d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'TBD';

  const daysUntil = startDate
    ? Math.ceil((startDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  const countdownLabel = (() => {
    if (daysUntil === null)  return null;
    if (daysUntil < 0)       return 'Departed';
    if (daysUntil === 0)     return 'Departing today!';
    if (daysUntil === 1)     return 'Departing tomorrow!';
    return `${daysUntil} days to go`;
  })();

  const countdownColor = (() => {
    if (daysUntil === null || daysUntil < 0) return 'text-base-content/40';
    if (daysUntil <= 3)  return 'text-warning font-bold';
    if (daysUntil <= 14) return 'text-primary font-semibold';
    return 'text-base-content/60';
  })();

  return (
    <Link
      to={`/trips/${trip.id}`}
      className={`group block rounded-2xl border border-base-200 bg-base-100 hover:border-primary/30 hover:shadow-elevation-3 transition-all duration-200 overflow-hidden ${className}`}
      aria-label={`View trip: ${trip.name || trip.destination}`}
    >
      {/* Hero image / colour strip */}
      {trip.image_url ? (
        <div className="h-32 overflow-hidden">
          <img
            src={trip.image_url}
            alt={trip.destination}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        </div>
      ) : (
        <div className="h-2 bg-gradient-to-r from-primary/60 to-brand-accent/60" />
      )}

      <div className="p-4 space-y-3">
        {/* Title */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-black text-base-content text-sm truncate leading-tight">
              {trip.name || trip.destination}
            </p>
            {trip.name && trip.destination && trip.name !== trip.destination && (
              <p className="flex items-center gap-1 text-xs text-base-content/50 mt-0.5 truncate">
                <MapPin size={11} className="flex-shrink-0 text-primary" aria-hidden="true" />
                {trip.destination}
              </p>
            )}
          </div>
          <Plane
            size={16}
            className="flex-shrink-0 text-primary/40 group-hover:text-primary transition-colors mt-0.5"
            aria-hidden="true"
          />
        </div>

        {/* Dates */}
        <div className="flex items-center gap-1.5 text-xs text-base-content/50">
          <Calendar size={12} aria-hidden="true" />
          <span>{formatDate(startDate)}</span>
          {endDate && (
            <>
              <ArrowRight size={10} aria-hidden="true" />
              <span>{formatDate(endDate)}</span>
            </>
          )}
        </div>

        {/* Countdown */}
        {countdownLabel && (
          <div className={`flex items-center gap-1.5 text-xs ${countdownColor}`}>
            <Clock size={12} aria-hidden="true" />
            <span>{countdownLabel}</span>
          </div>
        )}
      </div>
    </Link>
  );
};

UpcomingTripCard.propTypes = {
  trip: PropTypes.shape({
    id:          PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    name:        PropTypes.string,
    destination: PropTypes.string,
    start_date:  PropTypes.string,
    end_date:    PropTypes.string,
    image_url:   PropTypes.string,
    status:      PropTypes.string,
  }),
  className: PropTypes.string,
};

export default UpcomingTripCard;

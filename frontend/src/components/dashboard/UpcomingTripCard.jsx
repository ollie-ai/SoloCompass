/**
 * UpcomingTripCard — standalone trip countdown widget.
 *
 * Displays:
 *   - Destination name + departure date
 *   - Days-until-departure countdown (with urgency colour)
 *   - Readiness percentage ring
 *   - Quick "Open Trip" and "Safety" action links
 *
 * Used inside UpcomingDashboard and anywhere else a compact
 * trip preview is needed.
 */
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Calendar, Shield, MapPin } from 'lucide-react';
import PropTypes from 'prop-types';

const CIRCUMFERENCE = 2 * Math.PI * 28; // r=28

function buildCountdown(startDate) {
  if (!startDate) return null;
  const now = new Date();
  const start = new Date(startDate);
  const diff = Math.ceil((start - now) / (1000 * 60 * 60 * 24));
  if (diff <= 0) return { text: 'Today',    days: 0,    urgency: 'high' };
  if (diff === 1) return { text: 'Tomorrow', days: 1,    urgency: 'high' };
  if (diff <= 7)  return { text: `${diff} days`, days: diff, urgency: 'medium' };
  return           { text: `${diff} days`, days: diff, urgency: 'low' };
}

const URGENCY_COLOR = {
  high:   'text-error',
  medium: 'text-warning',
  low:    'text-primary',
};

export default function UpcomingTripCard({ trip, readinessPct = 0 }) {
  const countdown = useMemo(() => buildCountdown(trip?.start_date), [trip?.start_date]);

  if (!trip) return null;

  const urgencyColor = URGENCY_COLOR[countdown?.urgency ?? 'low'];
  const departureFormatted = trip.start_date
    ? new Date(trip.start_date).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
      })
    : '—';

  const strokeOffset = CIRCUMFERENCE * (1 - (readinessPct ?? 0) / 100);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-base-100 rounded-2xl border border-base-300 shadow-elevation-2 p-5 flex items-center gap-5"
    >
      {/* Countdown ring */}
      <div className="relative w-16 h-16 shrink-0" aria-label={`${countdown?.days ?? 0} days until departure`}>
        <svg className="w-full h-full -rotate-90" aria-hidden="true">
          <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="4" fill="transparent" className="text-base-200" />
          <circle
            cx="32" cy="32" r="28"
            stroke="currentColor" strokeWidth="4" fill="transparent"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={strokeOffset}
            className={`${urgencyColor} transition-all duration-700`}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center leading-none pointer-events-none">
          <span className={`text-xl font-black ${urgencyColor}`}>{countdown?.days ?? '—'}</span>
          <span className="text-[9px] opacity-60 uppercase font-black tracking-tighter">Days</span>
        </div>
      </div>

      {/* Trip info */}
      <div className="flex-1 min-w-0">
        <p className="font-black text-base-content text-sm leading-tight truncate flex items-center gap-1.5">
          <MapPin size={12} className="text-primary shrink-0" aria-hidden="true" />
          {trip.destination ?? 'Upcoming Trip'}
        </p>
        <p className="text-xs text-muted mt-0.5 flex items-center gap-1.5">
          <Calendar size={11} aria-hidden="true" />
          {departureFormatted}
        </p>

        {/* Readiness bar */}
        <div className="mt-2.5">
          <div className="flex justify-between items-center mb-1">
            <span className="text-[10px] font-black uppercase tracking-widest text-muted">Readiness</span>
            <span className="text-[10px] font-black text-primary">{readinessPct}%</span>
          </div>
          <div className="h-1.5 w-full bg-base-200 rounded-full overflow-hidden" role="progressbar" aria-valuenow={readinessPct} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full bg-primary rounded-full transition-all duration-700" style={{ width: `${readinessPct}%` }} />
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-2 shrink-0">
        <Link
          to={`/trips/${trip.id}`}
          className="btn btn-primary btn-xs rounded-lg font-bold"
        >
          Open
        </Link>
        <Link
          to="/safety"
          className="btn btn-ghost btn-xs rounded-lg font-bold flex items-center gap-1"
          aria-label="Go to safety settings"
        >
          <Shield size={12} aria-hidden="true" />
          Safety
        </Link>
      </div>
    </motion.div>
  );
}

UpcomingTripCard.propTypes = {
  /** Trip object with at least { id, destination, start_date } */
  trip: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    destination: PropTypes.string,
    start_date: PropTypes.string,
  }),
  /** 0–100 pre-trip readiness percentage */
  readinessPct: PropTypes.number,
};

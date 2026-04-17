import PropTypes from 'prop-types';
import { MapPin, Calendar, Users, AlertCircle, CheckCircle, Clock } from 'lucide-react';

const STATUS_STYLES = {
  open: 'bg-brand-vibrant/10 text-brand-vibrant',
  full: 'bg-warning/10 text-warning',
  cancelled: 'bg-error/10 text-error',
  completed: 'bg-base-200 text-base-content/50',
};

const RSVP_ICONS = {
  going: <CheckCircle size={12} className="text-brand-vibrant" />,
  maybe: <Clock size={12} className="text-warning" />,
  not_going: null,
};

function formatMeetupDate(dateString) {
  if (!dateString) return 'Date TBD';
  const d = new Date(dateString);
  return d.toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
}

function MeetupCard({ meetup, onRSVP, rsvpLoading }) {
  const spotsLeft = (meetup.max_attendees || 10) - (meetup.attendee_count || 0);
  const statusLabel = meetup.status === 'full' ? 'Full' : meetup.status === 'cancelled' ? 'Cancelled' : 'Open';
  const myRSVP = meetup.my_rsvp;

  return (
    <div className="bg-base-100 rounded-xl border border-base-300/60 shadow-[0_2px_12px_-2px_rgba(0,0,0,0.06)] hover:shadow-[0_8px_30px_-6px_rgba(0,0,0,0.10)] transition-all p-5 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-bold text-base-content text-sm leading-snug">{meetup.title}</h3>
        <span className={`shrink-0 text-[10px] font-black px-2 py-0.5 rounded-full uppercase ${STATUS_STYLES[meetup.status] || STATUS_STYLES.open}`}>
          {statusLabel}
        </span>
      </div>

      {/* Meta */}
      <div className="space-y-1.5 text-xs text-base-content/60 font-medium">
        <div className="flex items-center gap-1.5">
          <MapPin size={12} className="text-base-content/30 shrink-0" />
          <span className="truncate">{meetup.location_name || meetup.destination}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Calendar size={12} className="text-base-content/30 shrink-0" />
          <span>{formatMeetupDate(meetup.meetup_date)}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Users size={12} className="text-base-content/30 shrink-0" />
          <span>{meetup.attendee_count || 0} going · {spotsLeft > 0 ? `${spotsLeft} spots left` : 'Full'}</span>
        </div>
      </div>

      {/* Description */}
      {meetup.description && (
        <p className="text-xs text-base-content/50 line-clamp-2">{meetup.description}</p>
      )}

      {/* Safety note */}
      {meetup.safety_notes && (
        <div className="flex items-start gap-1.5 text-[10px] text-warning/70 bg-warning/5 rounded-lg px-2.5 py-2">
          <AlertCircle size={10} className="shrink-0 mt-0.5" />
          <span className="line-clamp-2">{meetup.safety_notes}</span>
        </div>
      )}

      {/* Organizer */}
      <p className="text-[10px] text-base-content/40">
        Organised by <span className="font-bold">{meetup.organizer_name || 'Traveler'}</span>
      </p>

      {/* RSVP actions */}
      {meetup.status !== 'cancelled' && (
        <div className="pt-2 border-t border-base-300/50 flex gap-1.5">
          {(['going', 'maybe', 'not_going']).map((s) => {
            const labels = { going: 'Going', maybe: 'Maybe', not_going: 'Skip' };
            const isActive = myRSVP === s;
            return (
              <button
                key={s}
                disabled={rsvpLoading || (meetup.status === 'full' && s === 'going' && myRSVP !== 'going')}
                onClick={() => onRSVP?.(meetup.id, s)}
                className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-bold transition-colors disabled:opacity-40 ${
                  isActive
                    ? s === 'going'
                      ? 'bg-brand-vibrant text-white'
                      : s === 'maybe'
                        ? 'bg-warning text-white'
                        : 'bg-base-300 text-base-content/70'
                    : 'bg-base-200 text-base-content/60 hover:bg-base-300'
                }`}
              >
                {RSVP_ICONS[s]}
                {labels[s]}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

MeetupCard.propTypes = {
  meetup: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    title: PropTypes.string.isRequired,
    description: PropTypes.string,
    destination: PropTypes.string,
    location_name: PropTypes.string,
    meetup_date: PropTypes.string,
    max_attendees: PropTypes.number,
    attendee_count: PropTypes.number,
    status: PropTypes.string,
    my_rsvp: PropTypes.string,
    organizer_name: PropTypes.string,
    safety_notes: PropTypes.string,
  }).isRequired,
  onRSVP: PropTypes.func,
  rsvpLoading: PropTypes.bool,
};

export default MeetupCard;

import PropTypes from 'prop-types';
import { motion } from 'framer-motion';
import { Calendar, MapPin, MessageCircle, Shield, Sparkles, Users } from 'lucide-react';

function getInitials(name) {
  if (!name) return '?';
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
}

function getRelativeTime(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return '1 day ago';
  if (diffDays < 7) return `${diffDays} days ago`;
  const diffWeeks = Math.floor(diffDays / 7);
  if (diffWeeks === 1) return '1 week ago';
  if (diffWeeks < 4) return `${diffWeeks} weeks ago`;
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths === 1) return '1 month ago';
  return `${diffMonths} months ago`;
}

function getConnectionStatus(conn) {
  if (conn.trip?.endDate && new Date(conn.trip.endDate) < new Date()) {
    return { label: 'Trip ended', color: 'bg-base-200 text-base-content/60' };
  }
  return { label: 'Active', color: 'bg-brand-vibrant/10 text-brand-vibrant' };
}

/**
 * BuddyConnectionsList – renders the accepted buddy connections grid.
 * Extracted from Buddies.jsx for reuse.
 */
function BuddyConnectionsList({ connections, myProfile, onSafetyAction, onDiscoverClick, onProfileClick }) {
  const getSharedInfo = (conn) => {
    const shared = [];
    if (!myProfile) return shared;
    if (conn.trip?.destination && myProfile.destinations) {
      const myDests = Array.isArray(myProfile.destinations)
        ? myProfile.destinations
        : [myProfile.destinations];
      const connDest = conn.trip.destination;
      if (myDests.some((d) =>
        d.toLowerCase().includes(connDest.toLowerCase()) ||
        connDest.toLowerCase().includes(d.toLowerCase())
      )) {
        shared.push({ icon: MapPin, label: connDest });
      }
    }
    if (conn.user?.interests && myProfile.interests) {
      const sharedInterests = conn.user.interests.filter((i) =>
        myProfile.interests.includes(i)
      );
      if (sharedInterests.length > 0) {
        shared.push({ icon: Sparkles, label: sharedInterests.slice(0, 2).join(', ') });
      }
    }
    return shared;
  };

  if (connections.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-base-100 rounded-xl border border-base-300/60 shadow-[0_2px_12px_-2px_rgba(0,0,0,0.06)] p-10 text-center"
      >
        <div className="w-16 h-16 mx-auto mb-5 bg-base-200 rounded-2xl flex items-center justify-center">
          <MessageCircle className="w-8 h-8 text-base-content/30" />
        </div>
        <h3 className="text-lg font-black text-base-content mb-2">No connections yet</h3>
        <p className="text-base-content/60 font-medium text-sm mb-6 max-w-sm mx-auto">
          Start discovering travellers to build your solo travel network.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          {onDiscoverClick && (
            <button
              onClick={onDiscoverClick}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm bg-brand-vibrant text-white shadow-md shadow-brand-vibrant/25 hover:bg-emerald-600 transition-colors"
            >
              <Users size={16} /> Discover travellers
            </button>
          )}
          {onProfileClick && (
            <button
              onClick={onProfileClick}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm bg-base-100 border border-base-300 text-base-content/80 hover:border-brand-vibrant hover:text-brand-vibrant transition-colors"
            >
              Update Travel Profile
            </button>
          )}
        </div>
      </motion.div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {connections.map((conn, index) => {
        const status = getConnectionStatus(conn);
        const sharedInfo = getSharedInfo(conn);
        return (
          <motion.div
            key={conn.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1], delay: index * 0.05 }}
            className="bg-base-100 rounded-xl border border-base-300/60 shadow-[0_2px_12px_-2px_rgba(0,0,0,0.06)] p-5 hover:shadow-[0_8px_30px_-6px_rgba(0,0,0,0.10)] transition-shadow"
          >
            <div className="flex items-start gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-brand-vibrant/10 to-emerald-500/10 flex items-center justify-center shrink-0">
                <span className="text-base font-black text-brand-vibrant">
                  {getInitials(conn.user?.name)}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="font-bold text-base-content text-sm truncate">{conn.user?.name || 'Unknown'}</h4>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${status.color}`}>
                    {status.label}
                  </span>
                </div>
                <p className="text-xs text-base-content/40 font-medium mt-0.5">{conn.user?.location || 'Location unknown'}</p>
              </div>
              {onSafetyAction && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onSafetyAction(conn);
                  }}
                  className="p-2 rounded-lg hover:bg-base-200 text-base-content/40 hover:text-error transition-colors"
                  title="Block or report"
                >
                  <Shield size={14} />
                </button>
              )}
            </div>

            {sharedInfo.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {sharedInfo.map((info, i) => (
                  <span key={`shared-${info.label}-${i}`} className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold bg-brand-vibrant/10 text-brand-vibrant">
                    <info.icon size={10} /> {info.label}
                  </span>
                ))}
              </div>
            )}

            {conn.trip && (
              <div className="flex items-center gap-1.5 text-xs text-base-content/60 font-medium mb-3">
                <MapPin size={12} className="text-base-content/30" />
                {conn.trip.destination}
              </div>
            )}

            <div className="flex items-center gap-1.5 text-xs text-base-content/40 font-medium pt-3 border-t border-base-300/50">
              <Calendar size={12} />
              Connected {conn.connectedAt ? getRelativeTime(conn.connectedAt) : 'Recently'}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

BuddyConnectionsList.propTypes = {
  connections: PropTypes.array.isRequired,
  myProfile: PropTypes.object,
  onSafetyAction: PropTypes.func,
  onDiscoverClick: PropTypes.func,
  onProfileClick: PropTypes.func,
};

export default BuddyConnectionsList;

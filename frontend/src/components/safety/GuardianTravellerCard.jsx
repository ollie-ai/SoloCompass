import { useState } from 'react';
import { User, MapPin, Clock, AlertTriangle, Shield, Trash2, Navigation, ChevronDown, ChevronUp } from 'lucide-react';
import api from '../../lib/api';
import toast from 'react-hot-toast';

export default function GuardianTravellerCard({ traveller, onRemove }) {
  const [expanded, setExpanded] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [locationData, setLocationData] = useState(null);
  const [loadingLocation, setLoadingLocation] = useState(false);

  const handleRemove = async () => {
    if (!window.confirm(`Remove ${traveller.traveller_name} from your travellers?`)) return;
    setRemoving(true);
    try {
      await api.delete(`/guardian/${traveller.id}`);
      toast.success('Guardian relationship removed');
      onRemove?.(traveller.id);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to remove relationship');
    } finally {
      setRemoving(false);
    }
  };

  const fetchLocation = async () => {
    if (locationData) {
      setLocationData(null);
      return;
    }
    setLoadingLocation(true);
    try {
      const res = await api.get(`/guardian/${traveller.id}/location`);
      setLocationData(res.data?.data || null);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not fetch location');
    } finally {
      setLoadingLocation(false);
    }
  };

  const hasActiveSOS = !!traveller.activeSOS;

  return (
    <div className={`rounded-2xl border transition-all ${
      hasActiveSOS
        ? 'border-error/60 bg-error/5'
        : 'border-base-300/60 bg-base-100'
    }`}>
      {/* Header */}
      <div className="flex items-start gap-3 p-4">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
          hasActiveSOS ? 'bg-error/20' : 'bg-brand-vibrant/10'
        }`}>
          <User size={18} className={hasActiveSOS ? 'text-error' : 'text-brand-vibrant'} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="font-black text-base-content truncate">{traveller.traveller_name}</p>
            {hasActiveSOS ? (
              <span className="text-[10px] font-black bg-error text-white px-2 py-0.5 rounded-full animate-pulse shrink-0">
                🚨 SOS
              </span>
            ) : (
              <span className="text-[10px] font-bold bg-success/10 text-success px-2 py-0.5 rounded-full shrink-0">
                Safe
              </span>
            )}
          </div>
          <p className="text-xs text-base-content/60 truncate">{traveller.traveller_email}</p>

          {/* Last check-in */}
          {traveller.lastCheckIn && (
            <p className="text-xs text-base-content/50 mt-1 flex items-center gap-1">
              <Clock size={10} />
              Last seen: {new Date(traveller.lastCheckIn.created_at).toLocaleString(undefined, {
                month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
              })}
            </p>
          )}
        </div>

        <button
          onClick={() => setExpanded(!expanded)}
          className="text-base-content/40 hover:text-base-content/70 transition-colors"
        >
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-base-300/40 pt-3">
          {/* SOS detail */}
          {hasActiveSOS && (
            <div className="bg-error/10 border border-error/30 rounded-xl p-3">
              <p className="text-xs font-black text-error flex items-center gap-1.5">
                <AlertTriangle size={13} />
                SOS since {new Date(traveller.activeSOS.triggered_at).toLocaleTimeString()}
              </p>
              {(traveller.activeSOS.latitude || traveller.activeSOS.address) && (
                <p className="text-xs text-error/80 mt-1 flex items-center gap-1">
                  <MapPin size={11} />
                  {traveller.activeSOS.address || `${Number(traveller.activeSOS.latitude).toFixed(4)}, ${Number(traveller.activeSOS.longitude).toFixed(4)}`}
                </p>
              )}
            </div>
          )}

          {/* Location */}
          {traveller.permission_view_location && (
            <div>
              <button
                onClick={fetchLocation}
                disabled={loadingLocation}
                className="flex items-center gap-2 text-xs text-brand-vibrant font-bold hover:underline disabled:opacity-50"
              >
                <Navigation size={12} />
                {loadingLocation ? 'Loading...' : locationData ? 'Hide location' : 'View live location'}
              </button>
              {locationData?.location && (
                <p className="text-xs text-base-content/70 mt-1.5 flex items-center gap-1">
                  <MapPin size={11} />
                  {Number(locationData.location.latitude).toFixed(5)}, {Number(locationData.location.longitude).toFixed(5)}
                  <span className="text-base-content/40 ml-1">
                    ({new Date(locationData.location.updatedAt).toLocaleTimeString()})
                  </span>
                </p>
              )}
              {locationData && !locationData.location && (
                <p className="text-xs text-base-content/50 mt-1">Location sharing is currently off</p>
              )}
            </div>
          )}

          {/* Permissions */}
          <div className="flex flex-wrap gap-1.5">
            {traveller.permission_view_location && (
              <span className="text-[10px] bg-brand-vibrant/10 text-brand-vibrant px-2 py-0.5 rounded-full font-bold">📍 Location</span>
            )}
            {traveller.permission_receive_alerts && (
              <span className="text-[10px] bg-brand-vibrant/10 text-brand-vibrant px-2 py-0.5 rounded-full font-bold">🔔 Alerts</span>
            )}
            {traveller.permission_view_itinerary && (
              <span className="text-[10px] bg-brand-vibrant/10 text-brand-vibrant px-2 py-0.5 rounded-full font-bold">🗺 Itinerary</span>
            )}
          </div>

          {/* Remove */}
          <button
            onClick={handleRemove}
            disabled={removing}
            className="flex items-center gap-1.5 text-xs text-error hover:underline disabled:opacity-50 mt-1"
          >
            <Trash2 size={12} />
            {removing ? 'Removing...' : 'Remove relationship'}
          </button>
        </div>
      )}
    </div>
  );
}

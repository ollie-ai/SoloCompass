import { useState, useEffect } from 'react';
import { Shield, MapPin, AlertTriangle, Clock, User } from 'lucide-react';
import api from '../../lib/api';
import toast from 'react-hot-toast';

export default function GuardianDashboard() {
  const [travellers, setTravellers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      const res = await api.get('/guardian/dashboard');
      setTravellers(res.data?.data?.travellers || []);
    } catch (err) {
      setError('Failed to load guardian dashboard');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 text-center text-base-content/60">
        <div className="animate-spin w-8 h-8 border-2 border-brand-vibrant border-t-transparent rounded-full mx-auto mb-2" />
        Loading guardian dashboard...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-center text-error">
        <AlertTriangle size={24} className="mx-auto mb-2" />
        {error}
      </div>
    );
  }

  if (travellers.length === 0) {
    return (
      <div className="p-6 text-center text-base-content/60">
        <Shield size={40} className="mx-auto mb-3 opacity-30" />
        <p className="font-semibold">You're not guarding anyone yet</p>
        <p className="text-sm mt-1">You'll appear here when someone invites you as their guardian.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="font-black text-lg text-base-content">People I'm Guarding</h3>
      {travellers.map((t) => (
        <div key={t.id} className="border border-base-300/50 rounded-xl bg-base-100 p-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-brand-vibrant/10 rounded-xl flex items-center justify-center">
                <User size={18} className="text-brand-vibrant" />
              </div>
              <div>
                <p className="font-black text-base-content">{t.traveller_name}</p>
                <p className="text-xs text-base-content/60">{t.traveller_email}</p>
              </div>
            </div>
            {t.activeSOS ? (
              <span className="text-[10px] font-black bg-error text-white px-2 py-1 rounded-full animate-pulse uppercase">
                🚨 SOS Active
              </span>
            ) : (
              <span className="text-[10px] font-bold bg-success/10 text-success px-2 py-1 rounded-full uppercase">
                Safe
              </span>
            )}
          </div>

          {t.activeSOS && (
            <div className="bg-error/10 border border-error/30 rounded-lg p-3 mb-3">
              <p className="text-xs font-bold text-error flex items-center gap-2">
                <AlertTriangle size={14} />
                Active SOS since {new Date(t.activeSOS.triggered_at).toLocaleTimeString()}
              </p>
              {(t.activeSOS.latitude || t.activeSOS.address) && (
                <p className="text-xs text-error/80 mt-1 flex items-center gap-1">
                  <MapPin size={12} />
                  {t.activeSOS.address || `${t.activeSOS.latitude?.toFixed(4)}, ${t.activeSOS.longitude?.toFixed(4)}`}
                </p>
              )}
            </div>
          )}

          {t.lastCheckIn && (
            <div className="flex items-center gap-2 text-xs text-base-content/60">
              <Clock size={12} />
              Last check-in: {new Date(t.lastCheckIn.created_at).toLocaleString()}
              {t.lastCheckIn.address && <span>• {t.lastCheckIn.address}</span>}
            </div>
          )}

          {t.location_sharing_enabled && t.last_location_lat && (
            <div className="flex items-center gap-2 text-xs text-brand-vibrant mt-1">
              <MapPin size={12} />
              Location shared: {t.last_location_lat?.toFixed(4)}, {t.last_location_lng?.toFixed(4)}
              {t.last_location_at && <span className="text-base-content/50">({new Date(t.last_location_at).toLocaleTimeString()})</span>}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

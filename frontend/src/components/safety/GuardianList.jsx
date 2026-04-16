import { useState, useEffect } from 'react';
import { Shield, User, Trash2, RefreshCw, UserPlus } from 'lucide-react';
import api from '../../lib/api';
import toast from 'react-hot-toast';
import LocationSharingToggle from './LocationSharingToggle';

export default function GuardianList({ onInvite }) {
  const [guardians, setGuardians] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchGuardians();
  }, []);

  const fetchGuardians = async () => {
    try {
      const res = await api.get('/guardian/list');
      setGuardians(res.data?.data || []);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (id) => {
    if (!window.confirm('Remove this guardian?')) return;
    try {
      await api.delete(`/guardian/${id}`);
      setGuardians(prev => prev.filter(g => g.id !== id));
      toast.success('Guardian removed');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to remove guardian');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-base-content/60 text-sm p-4">
        <RefreshCw size={14} className="animate-spin" />
        Loading guardians...
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {guardians.length === 0 ? (
        <div className="p-6 text-center text-base-content/60">
          <Shield size={36} className="mx-auto mb-3 opacity-30" />
          <p className="font-semibold text-sm">No guardians yet</p>
          <p className="text-xs mt-1 mb-4">Invite someone to watch over your trips and receive alerts.</p>
          <button
            onClick={onInvite}
            className="inline-flex items-center gap-2 px-4 py-2 bg-brand-vibrant text-white rounded-xl font-bold text-xs hover:opacity-90"
          >
            <UserPlus size={14} />
            Invite a guardian
          </button>
        </div>
      ) : (
        <>
          {guardians.map((g) => (
            <div key={g.id} className="flex items-start gap-3 p-3 rounded-xl bg-base-200/50 border border-base-300/40">
              <div className="w-9 h-9 rounded-xl bg-brand-vibrant/10 flex items-center justify-center shrink-0">
                <User size={16} className="text-brand-vibrant" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-black text-sm text-base-content truncate">
                    {g.guardian_name || g.guardianName || g.guardian_email || g.guardianEmail}
                  </p>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                    g.status === 'active'
                      ? 'bg-success/10 text-success'
                      : g.status === 'pending'
                      ? 'bg-warning/10 text-warning'
                      : 'bg-base-300 text-base-content/50'
                  }`}>
                    {g.status}
                  </span>
                </div>
                {g.guardian_email && g.guardian_name && (
                  <p className="text-xs text-base-content/50 truncate">{g.guardian_email}</p>
                )}
                {g.status === 'active' && g.id && (
                  <div className="mt-2">
                    <LocationSharingToggle relationshipId={g.id} initialEnabled={!!g.location_sharing_enabled} />
                  </div>
                )}
              </div>
              <button
                onClick={() => handleRemove(g.id)}
                className="text-error/50 hover:text-error transition-colors shrink-0"
                title="Remove guardian"
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}

          <button
            onClick={onInvite}
            className="w-full flex items-center justify-center gap-2 border border-dashed border-brand-vibrant/40 text-brand-vibrant rounded-xl py-2.5 text-xs font-bold hover:bg-brand-vibrant/5 transition-colors"
          >
            <UserPlus size={14} />
            Add another guardian
          </button>
        </>
      )}
    </div>
  );
}

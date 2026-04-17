import { useEffect, useState } from 'react';
import { Monitor, Smartphone, Trash2, Loader } from 'lucide-react';
import api from '../lib/api';
import toast from 'react-hot-toast';

export default function SessionsList() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [revoking, setRevoking] = useState(null);

  const fetchSessions = async () => {
    try {
      const res = await api.get('/auth/sessions');
      setSessions(res.data.data?.sessions || []);
    } catch (err) {
      console.error('Failed to fetch sessions', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSessions(); }, []);

  const revokeSession = async (id) => {
    setRevoking(id);
    try {
      await api.delete(`/auth/sessions/${id}`);
      setSessions(s => s.filter(session => session.id !== id));
      toast.success('Session revoked');
    } catch (err) {
      toast.error('Failed to revoke session');
    } finally {
      setRevoking(null);
    }
  };

  const revokeAll = async () => {
    try {
      await api.post('/auth/logout-other-devices');
      await fetchSessions();
      toast.success('All other sessions revoked');
    } catch (err) {
      toast.error('Failed to revoke sessions');
    }
  };

  if (loading) return <div className="flex justify-center py-4"><div className="loading loading-spinner" /></div>;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Active Sessions</h3>
        {sessions.length > 1 && (
          <button onClick={revokeAll} className="btn btn-outline btn-error btn-xs">Log Out All Other Devices</button>
        )}
      </div>
      {sessions.length === 0 && <p className="text-sm text-base-content/60">No active sessions found.</p>}
      {sessions.map(session => (
        <div key={session.id} className="flex items-center justify-between p-3 bg-base-200 rounded-lg">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-base-300 flex items-center justify-center">
              {session.device_info?.toLowerCase().includes('mobile') || session.device_info?.toLowerCase().includes('android') || session.device_info?.toLowerCase().includes('iphone')
                ? <Smartphone className="w-4 h-4" />
                : <Monitor className="w-4 h-4" />
              }
            </div>
            <div>
              <p className="text-sm font-medium">{session.device_info || 'Unknown Device'}</p>
              <p className="text-xs text-base-content/50">
                {session.ip_address ? `${session.ip_address} · ` : ''}
                {session.created_at ? `Started ${new Date(session.created_at).toLocaleDateString()}` : ''}
              </p>
            </div>
          </div>
          <button onClick={() => revokeSession(session.id)} disabled={revoking === session.id} className="btn btn-ghost btn-xs text-error">
            {revoking === session.id ? <Loader className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
          </button>
        </div>
      ))}
    </div>
  );
}

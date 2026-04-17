import { useState, useEffect } from 'react';
import api from '../../lib/api';
import toast from 'react-hot-toast';
import ConfirmDialog from '../ConfirmDialog';
import { 
  Monitor, 
  Smartphone, 
  Tablet, 
  Globe, 
  Clock, 
  Trash2,
  RefreshCw,
  Search,
  User,
  Shield,
  Power
} from 'lucide-react';

const SessionManagement = () => {
  const [sessions, setSessions] = useState([]);
  const [userStats, setUserStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [terminating, setTerminating] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState({ open: false, action: null, id: null });

  useEffect(() => {
    fetchSessions();
  }, [selectedUserId]);

  const fetchSessions = async () => {
    try {
      setLoading(true);
      const params = {};
      if (selectedUserId) params.userId = selectedUserId;
      
      const response = await api.get('/admin/sessions', { params });
      setSessions(response.data.data?.sessions || []);
      setUserStats(response.data.data?.userStats || []);
    } catch (error) {
      toast.error('Failed to fetch sessions');
    } finally {
      setLoading(false);
    }
  };

  const handleTerminateSession = (sessionId) => {
    setConfirmDialog({ open: true, action: 'session', id: sessionId });
  };

  const handleTerminateAllUserSessions = (userId) => {
    setConfirmDialog({ open: true, action: 'all_user', id: userId });
  };

  const executeTerminate = async () => {
    const { action, id } = confirmDialog;
    setConfirmDialog({ open: false, action: null, id: null });
    try {
      if (action === 'session') {
        setTerminating(id);
        await api.post(`/admin/sessions/${id}/terminate`);
        toast.success('Session terminated');
      } else {
        setTerminating(`user-${id}`);
        await api.post(`/admin/sessions/user/${id}/terminate-all`);
        toast.success('All user sessions terminated');
      }
      fetchSessions();
    } catch (error) {
      toast.error('Failed to terminate session(s)');
    } finally {
      setTerminating(null);
    }
  };

  const getDeviceIcon = (userAgent, deviceInfo) => {
    if (!deviceInfo && !userAgent) return <Monitor size={16} />;
    const ua = (deviceInfo || userAgent || '').toLowerCase();
    if (ua.includes('iphone') || ua.includes('android')) return <Smartphone size={16} />;
    if (ua.includes('ipad') || ua.includes('tablet')) return <Tablet size={16} />;
    return <Monitor size={16} />;
  };

  const formatLastActivity = (dateStr) => {
    if (!dateStr) return 'Unknown';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'Unknown';
    return new Date(dateStr).toLocaleString();
  };

  const filteredSessions = sessions.filter(s => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      s.user_email?.toLowerCase().includes(search) ||
      s.user_name?.toLowerCase().includes(search) ||
      s.ip_address?.includes(search) ||
      s.device_info?.toLowerCase().includes(search)
    );
  });

  const getSessionCountForUser = (userId) => {
    return sessions.filter(s => s.user_id === userId).length;
  };

  return (
    <div className="space-y-6">
      <ConfirmDialog
        open={confirmDialog.open}
        onConfirm={executeTerminate}
        onCancel={() => setConfirmDialog({ open: false, action: null, id: null })}
        title={confirmDialog.action === 'all_user' ? 'Terminate All User Sessions?' : 'Terminate Session?'}
        description={confirmDialog.action === 'all_user'
          ? 'This will terminate ALL sessions for this user. They will be logged out immediately.'
          : 'This session will be terminated and the user will be logged out.'}
        confirmLabel="Terminate"
        variant="danger"
      />
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-base-content">Session Management</h2>
          <p className="text-base-content/60 mt-1">Monitor and manage active user sessions</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchSessions}
            disabled={loading}
            className="btn btn-primary btn-sm gap-2"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* User Stats Cards */}
      {userStats.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {userStats.slice(0, 4).map((stat) => (
            <div key={stat.user_id} className="card bg-base-200/50 border border-base-300">
              <div className="card-body p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-primary/20 text-primary flex items-center justify-center">
                      <User size={16} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-base-content truncate">{stat.user_email}</p>
                      <p className="text-xs text-base-content/60">{stat.session_count} active session{stat.session_count !== 1 ? 's' : ''}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleTerminateAllUserSessions(stat.user_id)}
                    disabled={terminating === `user-${stat.user_id}`}
                    className="btn btn-error btn-xs"
                    title="Terminate all sessions"
                  >
                    {terminating === `user-${stat.user_id}` ? (
                      <RefreshCw size={14} className="animate-spin" />
                    ) : (
                      <Power size={14} />
                    )}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40" size={18} />
          <input
            type="text"
            placeholder="Search by email, IP, device..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input input-bordered w-full pl-10 bg-base-200/50"
          />
        </div>
        {selectedUserId && (
          <button
            onClick={() => setSelectedUserId(null)}
            className="btn btn-ghost btn-sm"
          >
            Clear filter
          </button>
        )}
      </div>

      {/* Sessions Table */}
      <div className="card bg-base-100 border border-base-300 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table w-full">
            <thead>
              <tr className="bg-base-200/50">
                <th className="text-base-content/70">User</th>
                <th className="text-base-content/70">Device</th>
                <th className="text-base-content/70">IP Address</th>
                <th className="text-base-content/70">Last Activity</th>
                <th className="text-base-content/70">Created</th>
                <th className="text-base-content/70">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-8">
                    <RefreshCw className="animate-spin mx-auto text-primary" size={24} />
                    <p className="text-base-content/60 mt-2">Loading sessions...</p>
                  </td>
                </tr>
              ) : filteredSessions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8">
                    <Shield size={48} className="mx-auto text-base-content/20 mb-2" />
                    <p className="text-base-content/60">No active sessions found</p>
                  </td>
                </tr>
              ) : (
                filteredSessions.map((session) => (
                  <tr key={session.id} className="hover:bg-base-200/30">
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                          <User size={16} />
                        </div>
                        <div>
                          <p className="font-medium text-base-content">{session.user_name || 'Unknown'}</p>
                          <p className="text-xs text-base-content/60">{session.user_email}</p>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        {getDeviceIcon(session.user_agent, session.device_info)}
                        <div>
                          <p className="text-sm text-base-content">{session.device_info || 'Unknown Device'}</p>
                          <p className="text-xs text-base-content/50 truncate max-w-[150px]">{session.user_agent?.substring(0, 50)}</p>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center gap-1">
                        <Globe size={14} className="text-base-content/40" />
                        <span className="text-sm font-mono text-base-content">{session.ip_address || 'Unknown'}</span>
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center gap-1">
                        <Clock size={14} className="text-base-content/40" />
                        <span className="text-sm text-base-content">{formatLastActivity(session.last_activity)}</span>
                      </div>
                    </td>
                    <td>
                      <span className="text-sm text-base-content/70">{formatDate(session.created_at)}</span>
                    </td>
                    <td>
                      <button
                        onClick={() => handleTerminateSession(session.id)}
                        disabled={terminating === session.id}
                        className="btn btn-error btn-xs"
                        title="Terminate session"
                      >
                        {terminating === session.id ? (
                          <RefreshCw size={14} className="animate-spin" />
                        ) : (
                          <Trash2 size={14} />
                        )}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary */}
      <div className="flex items-center justify-between text-sm text-base-content/60">
        <p>Showing {filteredSessions.length} of {sessions.length} active sessions</p>
        <p>Total unique users: {userStats.length}</p>
      </div>
    </div>
  );
};

export default SessionManagement;

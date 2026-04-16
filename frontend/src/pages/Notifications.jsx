import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '../stores/authStore';
import api from '../lib/api';
import Loading from '../components/Loading';
import { 
  Bell, Check, CheckSquare, Trash2 as Trash, 
  AlertTriangle as Warning, Clock, MapPin, 
  Info as InfoIcon, ChevronRight, X, Settings as SettingsIcon,
  Filter, Calendar, Ghost, ExternalLink
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

/**
 * Maps a notification to its deep-link route.
 */
function getNotificationRoute(notification) {
  const type = notification.type;
  const data = typeof notification.data === 'string'
    ? (() => { try { return JSON.parse(notification.data); } catch { return {}; } })()
    : (notification.data || {});

  switch (type) {
    case 'checkin_reminder':
    case 'checkin_missed':
    case 'checkin_sos':
    case 'checkin_sent':
    case 'checkin_confirmed':
    case 'checkin_scheduled':
      return '/safety';
    case 'trip_update':
    case 'trip_created':
    case 'itinerary_generated':
      return data.tripId ? `/trips/${data.tripId}` : '/trips';
    case 'buddy_request':
    case 'buddy_accepted':
    case 'buddy_match':
      return '/buddies';
    case 'message':
    case 'new_message':
      return data.conversationId ? `/messages/${data.conversationId}` : '/messages';
    case 'advisory':
    case 'travel_advisory':
      return data.destinationId ? `/destinations/${data.destinationId}` : '/advisories';
    case 'budget_alert':
    case 'flight_update':
    case 'flight_change':
    case 'document_expiry':
      return data.tripId ? `/trips/${data.tripId}` : '/trips';
    case 'billing':
    case 'subscription':
    case 'payment':
      return '/settings?tab=billing';
    case 'verification':
      return '/settings?tab=profile';
    default:
      return null;
  }
}

const Notifications = () => {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    fetchNotifications();
  }, [unreadOnly]);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/notifications?unreadOnly=${unreadOnly}&limit=100`);
      if (res.data.success) {
        setNotifications(res.data.data.notifications || []);
        setTotalCount(res.data.data.total || 0);
        setUnreadCount(res.data.data.unread || 0);
      }
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
      toast.error('Failed to load notifications');
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (id) => {
    try {
      await api.put(`/notifications/${id}/read`);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Failed to mark as read:', err);
    }
  };

  const markAllAsRead = async () => {
    try {
      await api.put('/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
      toast.success('All notifications marked as read');
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  };

  const deleteNotification = async (id) => {
    try {
      await api.delete(`/notifications/${id}`);
      setNotifications(prev => prev.filter(n => n.id !== id));
      toast.success('Notification deleted');
      fetchNotifications(); // Refresh counts
    } catch (err) {
      console.error('Failed to delete notification:', err);
    }
  };

  const getIcon = (type) => {
    switch (type) {
      case 'advisory': return <Warning className="text-warning" />;
      case 'checkin_reminder': return <Clock className="text-blue-500" />;
      case 'checkin_missed': return <Warning className="text-error" />;
      case 'checkin_sos': return <Warning className="text-error" />;
      case 'trip_update': return <MapPin className="text-emerald-500" />;
      default: return <InfoIcon className="text-base-content/60" />;
    }
  };

  const formatTime = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleString('en-GB', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 sm:py-12 pb-24">
      <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-brand-vibrant/10 text-brand-vibrant text-[10px] font-black uppercase tracking-widest mb-3">
            Communication Hub
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-base-content">Notifications</h1>
          <p className="text-base-content/60 font-medium mt-1">Stay updated on your safety status, trip changes, and travel buddy activity.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/settings?tab=notifications')}
            className="p-2.5 bg-base-100 border border-base-300 rounded-xl hover:bg-base-200 text-base-content/80 transition-all shadow-sm"
            title="Notification Settings"
          >
            <SettingsIcon size={20} />
          </button>
          <button
            onClick={markAllAsRead}
            disabled={unreadCount === 0}
            className="flex items-center gap-2 px-4 py-2.5 bg-base-100 border border-base-300 rounded-xl hover:bg-base-200 text-base-content/80 font-bold text-sm transition-all shadow-sm disabled:opacity-50"
          >
            <CheckSquare size={18} /> Mark all read
          </button>
        </div>
      </div>

      <div className="flex items-center gap-4 mb-6 pb-2 border-b border-base-300/50">
        <button
          onClick={() => setUnreadOnly(false)}
          className={`pb-3 px-1 text-sm font-black transition-all relative ${!unreadOnly ? 'text-brand-vibrant' : 'text-base-content/40 hover:text-base-content/80'}`}
        >
          All Activity
          {!unreadOnly && <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-1 bg-brand-vibrant rounded-full" />}
        </button>
        <button
          onClick={() => setUnreadOnly(true)}
          className={`pb-3 px-1 text-sm font-black transition-all relative ${unreadOnly ? 'text-brand-vibrant' : 'text-base-content/40 hover:text-base-content/80'}`}
        >
          Unread {unreadCount > 0 && `(${unreadCount})`}
          {unreadOnly && <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-1 bg-brand-vibrant rounded-full" />}
        </button>
      </div>

      {loading ? (
        <div className="py-20 flex flex-col items-center">
          <Loading />
          <p className="mt-4 text-base-content/40 font-medium">Syncing hub...</p>
        </div>
      ) : notifications.length === 0 ? (
        <div className="py-20 bg-base-100 rounded-3xl border border-base-300/50 shadow-sm flex flex-col items-center justify-center text-center px-6">
          <div className="w-20 h-20 bg-base-200 rounded-full flex items-center justify-center mb-6">
            <Ghost size={40} className="text-base-content/20" />
          </div>
          <h2 className="text-xl font-bold text-base-content">No notifications found</h2>
          <p className="text-base-content/60 mt-2 max-w-sm">
            {unreadOnly 
              ? "You've caught up with all your updates. Great job!" 
              : "Looks like you don't have any activity yet. Plan a trip or set up safety check-ins to get started."}
          </p>
          {!unreadOnly && (
             <button onClick={() => navigate('/trips/new')} className="mt-8 bg-brand-vibrant text-white px-6 py-3 rounded-xl font-bold btn-premium shadow-lg shadow-brand-vibrant/20">
               Start a New Trip
             </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((notification) => (
            <motion.div
              key={notification.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`group flex items-start gap-4 p-5 rounded-2xl border transition-all ${
                notification.is_read 
                  ? 'bg-base-100/50 border-base-300/50 opacity-80' 
                  : 'bg-base-100 border-brand-vibrant/20 shadow-md shadow-brand-vibrant/5 ring-1 ring-brand-vibrant/5'
              }`}
            >
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                notification.is_read ? 'bg-base-200' : 'bg-brand-vibrant/10'
              }`}>
                {getIcon(notification.type)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-4 mb-1">
                  <h3 className={`text-base font-black truncate ${notification.is_read ? 'text-base-content/80' : 'text-base-content'}`}>
                    {notification.title}
                  </h3>
                  <span className="text-[10px] font-bold text-base-content/40 whitespace-nowrap uppercase tracking-widest flex items-center gap-1">
                    <Calendar size={10} /> {formatTime(notification.created_at)}
                  </span>
                </div>
                <p className={`text-sm leading-relaxed mb-4 ${notification.is_read ? 'text-base-content/40' : 'text-base-content/80 font-medium'}`}>
                  {notification.message}
                </p>
                <div className="flex items-center gap-2">
                  {!notification.is_read && (
                    <button
                      onClick={() => markAsRead(notification.id)}
                      className="text-[10px] font-black text-brand-vibrant uppercase tracking-widest px-3 py-1.5 bg-brand-vibrant/10 rounded-lg hover:bg-brand-vibrant/20 transition-all"
                    >
                      Mark read
                    </button>
                  )}
                  {getNotificationRoute(notification) && (
                    <button
                      onClick={() => {
                        if (!notification.is_read) markAsRead(notification.id);
                        navigate(getNotificationRoute(notification));
                      }}
                      className="text-[10px] font-black text-blue-500 uppercase tracking-widest px-3 py-1.5 bg-blue-500/10 rounded-lg hover:bg-blue-500/20 transition-all flex items-center gap-1"
                    >
                      <ExternalLink size={10} /> View
                    </button>
                  )}
                  <button
                    onClick={() => deleteNotification(notification.id)}
                    className="text-[10px] font-black text-base-content/40 uppercase tracking-widest px-3 py-1.5 hover:text-error hover:bg-error/10 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Notifications;

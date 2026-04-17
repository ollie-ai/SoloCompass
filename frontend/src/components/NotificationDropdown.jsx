import { useState, useEffect, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import PropTypes from 'prop-types';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, X, Check, CheckSquare, Trash2 as Trash, AlertTriangle as Warning, Clock, MapPin, Info } from 'lucide-react';
import api from '../lib/api';
import { useWebSocket } from '../hooks/useWebSocket';

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

const NotificationDropdown = memo(({ unreadCount, onCountChange }) => {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const { isConnected, on } = useWebSocket();

  useEffect(() => {
    if (isOpen && notifications.length === 0) {
      fetchNotifications();
    }
  }, [isOpen]);

  useEffect(() => {
    const interval = setInterval(() => {
      fetchUnreadCount();
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const offNew = on('notification:new', (payload) => {
      const incoming = payload?.notification;
      if (!incoming) return;
      setNotifications((prev) => [incoming, ...prev].slice(0, 20));
      onCountChange?.((unreadCount || 0) + 1);
    });
    const offLegacy = on('notification', (payload) => {
      const incoming = payload?.notification;
      if (!incoming) return;
      setNotifications((prev) => [incoming, ...prev].slice(0, 20));
      onCountChange?.((unreadCount || 0) + 1);
    });
    return () => {
      offNew?.();
      offLegacy?.();
    };
  }, [on, onCountChange, unreadCount]);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const res = await api.get('/notifications?limit=20&page=1');
      setNotifications(res.data.data?.notifications || res.data.data || []);
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchUnreadCount = async () => {
    try {
      const res = await api.get('/notifications/unread-count');
      const count = res.data.data?.count || 0;
      onCountChange?.(count);
    } catch (err) {
      console.error('Failed to fetch unread count:', err);
    }
  };

  const markAsRead = async (id) => {
    try {
      await api.put(`/notifications/${id}/read`);
      setNotifications(prev =>
        prev.map(n => n.id === id ? { ...n, read: true } : n)
      );
      fetchUnreadCount();
    } catch (err) {
      console.error('Failed to mark as read:', err);
    }
  };

  const markAllAsRead = async () => {
    try {
      await api.put('/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      onCountChange?.(0);
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  };

  const deleteNotification = async (id) => {
    try {
      await api.delete(`/notifications/${id}`);
      setNotifications(prev => prev.filter(n => n.id !== id));
      fetchUnreadCount();
    } catch (err) {
      console.error('Failed to delete notification:', err);
    }
  };

  const getIcon = (type) => {
    switch (type) {
      case 'advisory':
        return <Warning size={20} className="text-warning" />;
      case 'checkin_reminder':
        return <Clock size={20} className="text-blue-500" />;
      case 'checkin_missed':
        return <Warning size={20} className="text-error" />;
      case 'checkin_sos':
        return <Warning size={20} className="text-error" />;
      case 'checkin_sent':
      case 'checkin_confirmed':
        return <Check size={20} className="text-emerald-500" />;
      case 'checkin_scheduled':
        return <Clock size={20} className="text-primary" />;
      case 'trip_update':
        return <MapPin size={20} className="text-emerald-500" />;
      default:
        return <Info size={20} className="text-base-content/60" />;
    }
  };

  const getTypeBg = (type, read) => {
    if (read) return 'bg-base-200/50';
    switch (type) {
      case 'advisory':
        return 'bg-warning/5';
      case 'checkin_reminder':
        return 'bg-blue-500/5';
      case 'checkin_missed':
        return 'bg-error/5';
      case 'checkin_sos':
        return 'bg-error/10';
      case 'trip_update':
        return 'bg-success/5';
      default:
        return 'bg-base-200/50';
    }
  };

  const formatTime = (dateStr) => {
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

  const unreadNotifications = Array.isArray(notifications) ? notifications.filter(n => !n.is_read && !n.read) : [];

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Notifications"
        className="relative p-2.5 rounded-xl text-base-content/60 hover:bg-base-200 hover:text-base-content transition-colors"
      >
        <Bell size={22} className={isOpen ? 'fill-current' : ''} />
        {unreadCount > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center bg-error/100 text-white text-[10px] font-bold rounded-full px-1"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </motion.span>
        )}
        {isConnected && (
          <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-emerald-400 rounded-full border border-white"></span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[55]"
              onClick={() => setIsOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.96 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 top-full mt-2 w-[380px] max-h-[520px] bg-base-100 rounded-2xl shadow-2xl border border-base-300 overflow-hidden z-[60]"
            >
              <div className="px-4 py-3 border-b border-base-200 flex items-center justify-between bg-gradient-to-r from-base-200 to-base-100">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-base-content">Notifications</h3>
                  {unreadNotifications.length > 0 && (
                    <span className="px-2 py-0.5 bg-primary/10 text-primary text-xs font-bold rounded-full">
                      {unreadNotifications.length} new
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {unreadNotifications.length > 0 && (
                    <button
                      onClick={markAllAsRead}
                      className="p-1.5 text-xs text-base-content/40 hover:text-primary hover:bg-primary/5 rounded-lg transition-colors"
                      title="Mark all as read"
                      aria-label="Mark all as read"
                    >
                      <CheckSquare size={16} />
                    </button>
                  )}
                  <button
                    onClick={() => setIsOpen(false)}
                    className="p-1.5 text-base-content/40 hover:text-base-content hover:bg-base-200 rounded-lg transition-colors"
                    aria-label="Close notifications"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              <div className="overflow-y-auto max-h-[440px]">
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="w-6 h-6 border-2 border-base-300 border-t-primary rounded-full animate-spin" />
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                    <Bell size={40} className="text-base-content/20 mb-3" />
                    <p className="text-sm font-semibold text-base-content/60">No notifications</p>
                    <p className="text-xs text-base-content/40 mt-1">You're all caught up!</p>
                  </div>
                ) : (
                  <div className="divide-y divide-base-content/5">
                    {notifications.map(notification => (
                      <motion.div
                        key={notification.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className={`group relative px-4 py-3 transition-colors cursor-pointer ${getTypeBg(notification.type, notification.read)}`}
                        onClick={() => {
                          if (!notification.read) markAsRead(notification.id);
                          const route = getNotificationRoute(notification);
                          if (route) {
                            setIsOpen(false);
                            navigate(route);
                          }
                        }}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`mt-0.5 flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${
                            notification.read ? 'bg-base-200' : 'bg-base-100 shadow-sm'
                          }`}>
                            {getIcon(notification.type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <p className={`text-sm leading-tight ${
                                notification.read ? 'text-base-content/40 font-medium' : 'text-base-content font-semibold'
                              }`}>
                                {notification.title}
                              </p>
                              {!notification.read && (
                                <span className="w-2 h-2 bg-primary rounded-full flex-shrink-0 mt-1.5" />
                              )}
                            </div>
                            <p className="text-xs text-base-content/60 mt-1 line-clamp-2">
                              {notification.message}
                            </p>
                            <div className="flex items-center gap-2 mt-1.5">
                              <span className="text-[11px] text-base-content/40">
                                {formatTime(notification.createdAt)}
                              </span>
                              <span className="text-[11px] px-1.5 py-0.5 bg-base-200 text-base-content/60 rounded capitalize">
                                {notification.type.replace('_', ' ')}
                              </span>
                            </div>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteNotification(notification.id);
                            }}
                            className="opacity-0 group-hover:opacity-100 p-1 text-base-content/40 hover:text-error hover:bg-error/10 rounded transition-all"
                            aria-label="Delete notification"
                          >
                            <Trash size={14} />
                          </button>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>

              {notifications.length > 0 && (
                <div className="px-4 py-2.5 border-t border-base-200 bg-base-200">
                  <button
                    onClick={() => {
                      setIsOpen(false);
                      window.location.href = '/notifications';
                    }}
                    className="w-full text-center text-xs font-semibold text-primary hover:text-success transition-colors"
                  >
                    View all notifications
                  </button>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
});

NotificationDropdown.propTypes = {
  unreadCount: PropTypes.number,
  onCountChange: PropTypes.func,
};

export default memo(NotificationDropdown);

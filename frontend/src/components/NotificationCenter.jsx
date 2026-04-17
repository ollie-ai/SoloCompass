import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Check, Trash2, X, Settings, CheckCheck } from 'lucide-react';
import api from '../lib/api';
import { useWebSocket } from '../hooks/useWebSocket';

/**
 * Maps a notification to its deep-link route.
 * Returns null if no deep link is available.
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
      return data.tripId ? `/trips/${data.tripId}` : '/trips';
    case 'flight_update':
    case 'flight_change':
      return data.tripId ? `/trips/${data.tripId}` : '/trips';
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

export default function NotificationCenter() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef(null);
  const { isConnected } = useWebSocket();
  const navigate = useNavigate();

  const handleNotificationClick = async (notification) => {
    // Mark as read first
    if (!notification.is_read) {
      await handleMarkRead(notification.id);
    }
    // Navigate to deep link
    const route = getNotificationRoute(notification);
    if (route) {
      setIsOpen(false);
      navigate(route);
    }
  };

  useEffect(() => {
    fetchNotifications();
    fetchUnreadCount();
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchNotifications = async () => {
    try {
      const res = await api.get('/notifications?limit=20');
      if (res.data.success) {
        setNotifications(res.data.data.notifications);
      }
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    }
  };

  const fetchUnreadCount = async () => {
    try {
      const res = await api.get('/notifications/unread-count');
      if (res.data.success) {
        setUnreadCount(res.data.data.count);
      }
    } catch (err) {
      console.error('Failed to fetch unread count:', err);
    }
  };

  const handleMarkRead = async (id) => {
    try {
      await api.put(`/notifications/${id}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: 1 } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Failed to mark read:', err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.put('/notifications/read-all');
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: 1 })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed to mark all read:', err);
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/notifications/${id}`);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    } catch (err) {
      console.error('Failed to delete notification:', err);
    }
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  const getIcon = (type) => {
    switch (type) {
      case 'checkin_reminder':
        return '⏰';
      case 'checkin_missed':
        return '⚠️';
      case 'checkin_sos':
        return '🚨';
      case 'checkin_sent':
        return '✅';
      case 'checkin_scheduled':
        return '📅';
      case 'checkin_confirmed':
        return '✓';
      case 'emergency':
        return '🚨';
      default:
        return '🔔';
    }
  };

  const getBorderColor = (type) => {
    switch (type) {
      case 'checkin_sos':
      case 'emergency':
        return 'border-red-400 bg-error/10';
      case 'checkin_missed':
        return 'border-amber-400 bg-warning/10';
      case 'checkin_reminder':
        return 'border-blue-400 bg-blue-50';
      case 'checkin_sent':
      case 'checkin_confirmed':
        return 'border-emerald-400 bg-success/10';
      default:
        return 'border-gray-200 bg-base-100';
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) {
            fetchNotifications();
            fetchUnreadCount();
          }
        }}
        className="relative p-2 text-base-content/60 hover:text-brand-vibrant hover:bg-base-200 rounded-lg transition-colors"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-error/100 text-white text-xs rounded-full flex items-center justify-center font-bold animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
        {isConnected && (
          <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-white"></span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-96 bg-base-100 rounded-xl shadow-2xl border border-base-300 z-50 overflow-hidden">
          <div className="p-4 border-b border-base-300/50 bg-base-200 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-base-content">Notifications</h3>
              {unreadCount > 0 && (
                <p className="text-xs text-base-content/60">{unreadCount} unread</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="p-1.5 text-base-content/40 hover:text-brand-vibrant hover:bg-base-100 rounded transition-colors"
                  title="Mark all as read"
                >
                  <CheckCheck className="w-4 h-4" />
                </button>
              )}
              <a
                href="/settings?tab=notifications"
                className="p-1.5 text-base-content/40 hover:text-brand-vibrant hover:bg-base-100 rounded transition-colors"
                title="Notification settings"
              >
                <Settings className="w-4 h-4" />
              </a>
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <div className="p-8 text-center">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-vibrant mx-auto"></div>
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center text-base-content/40">
                <Bell className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No notifications yet</p>
                <p className="text-xs mt-1">We'll notify you about important events</p>
              </div>
            ) : (
              <div className="divide-y divide-base-300/30">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className={`p-4 border-l-4 transition-colors hover:bg-base-200/50 cursor-pointer ${getBorderColor(notification.type)} ${
                      !notification.is_read ? 'bg-opacity-100' : 'bg-opacity-50'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-xl flex-shrink-0 mt-0.5">
                        {getIcon(notification.type)}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className={`text-sm ${!notification.is_read ? 'font-bold text-base-content' : 'font-medium text-base-content/80'}`}>
                            {notification.title}
                          </p>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            {!notification.is_read && (
                              <button
                                onClick={() => handleMarkRead(notification.id)}
                                className="p-1 text-base-content/30 hover:text-success transition-colors"
                                title="Mark as read"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button
                              onClick={() => handleDelete(notification.id)}
                              className="p-1 text-base-content/30 hover:text-error transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                        <p className="text-xs text-base-content/60 mt-1">{notification.message}</p>
                        <p className="text-xs text-base-content/40 mt-1.5">{formatTime(notification.created_at)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {notifications.length > 0 && (
            <div className="p-3 border-t border-gray-100 bg-gray-50 text-center">
              <a
                href="/settings?tab=notifications"
                className="text-xs text-brand-vibrant hover:underline font-medium"
              >
                Manage notification preferences
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

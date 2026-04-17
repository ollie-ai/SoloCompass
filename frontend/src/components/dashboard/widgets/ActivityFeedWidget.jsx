import { Link } from 'react-router-dom';
import {
  Clock, MapPin, Shield, Users, Bell, Plane, Package,
  CheckCircle, AlertTriangle, MessageSquare, Star, Activity,
} from 'lucide-react';

const TYPE_META = {
  trip_created:     { icon: MapPin,        color: 'text-primary',   bg: 'bg-primary/10',   label: 'Trip' },
  trip_updated:     { icon: MapPin,        color: 'text-primary',   bg: 'bg-primary/10',   label: 'Trip' },
  trip_deleted:     { icon: MapPin,        color: 'text-error',     bg: 'bg-error/10',     label: 'Trip' },
  checkin:          { icon: CheckCircle,   color: 'text-success',   bg: 'bg-success/10',   label: 'Check-in' },
  checkin_missed:   { icon: AlertTriangle, color: 'text-warning',   bg: 'bg-warning/10',   label: 'Missed' },
  sos:              { icon: AlertTriangle, color: 'text-error',     bg: 'bg-error/10',     label: 'SOS' },
  safety:           { icon: Shield,        color: 'text-success',   bg: 'bg-success/10',   label: 'Safety' },
  buddy_request:    { icon: Users,         color: 'text-violet-500', bg: 'bg-violet-500/10', label: 'Buddy' },
  buddy_accepted:   { icon: Users,         color: 'text-violet-500', bg: 'bg-violet-500/10', label: 'Buddy' },
  buddy_matched:    { icon: Users,         color: 'text-violet-500', bg: 'bg-violet-500/10', label: 'Buddy' },
  message:          { icon: MessageSquare, color: 'text-sky-500',   bg: 'bg-sky-500/10',   label: 'Message' },
  notification:     { icon: Bell,          color: 'text-amber-500', bg: 'bg-amber-500/10', label: 'Alert' },
  flight:           { icon: Plane,         color: 'text-sky-500',   bg: 'bg-sky-500/10',   label: 'Flight' },
  packing:          { icon: Package,       color: 'text-teal-500',  bg: 'bg-teal-500/10',  label: 'Packing' },
  review:           { icon: Star,          color: 'text-amber-500', bg: 'bg-amber-500/10', label: 'Review' },
};

const SOURCE_LABEL = { notification: 'Notification', event: 'Event' };

const getTypeMeta = (type = '', source = '') => {
  const lower = String(type).toLowerCase();
  for (const [key, meta] of Object.entries(TYPE_META)) {
    if (lower.startsWith(key) || lower.includes(key)) return meta;
  }
  if (source === 'notification') {
    return TYPE_META.notification;
  }
  return { icon: Activity, color: 'text-base-content/50', bg: 'bg-base-200', label: SOURCE_LABEL[source] || 'Activity' };
};

const formatRelativeTime = (value) => {
  if (!value) return '';
  try {
    const diff = Date.now() - new Date(value).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  } catch {
    return '';
  }
};

const ActivityFeedWidget = ({ activity = [], loading = false, viewAllHref = '/dashboard' }) => {
  const items = activity.slice(0, 10);

  return (
    <div className="bg-base-100 rounded-xl border border-base-content/10 shadow-sm p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Clock size={16} className="text-brand-vibrant" />
          <h3 className="text-sm font-black text-base-content uppercase tracking-wider">Recent activity</h3>
        </div>
        {viewAllHref && (
          <Link to={viewAllHref} className="text-xs font-bold text-brand-vibrant hover:underline">
            View all
          </Link>
        )}
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-12 rounded-lg bg-base-200 animate-pulse" />
          ))}
        </div>
      ) : items.length > 0 ? (
        <div className="space-y-1.5">
          {items.map((item) => {
            const { icon: Icon, color, bg, label } = getTypeMeta(item.type, item.source);
            return (
              <div key={`${item.source}-${item.id}`} className="flex items-center gap-3 p-2 rounded-lg hover:bg-base-200/50 transition-colors">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${bg}`}>
                  <Icon size={14} className={color} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-base-content truncate">{item.title || item.type}</p>
                  {item.description && (
                    <p className="text-xs text-base-content/50 truncate">{item.description}</p>
                  )}
                </div>
                <div className="flex-shrink-0 text-right">
                  <span className={`text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded ${bg} ${color}`}>{label}</span>
                  <p className="text-[10px] text-base-content/30 mt-0.5">{formatRelativeTime(item.occurredAt)}</p>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="py-6 text-center">
          <Activity size={24} className="mx-auto text-base-content/20 mb-2" />
          <p className="text-sm text-base-content/40 font-medium">No recent activity yet.</p>
        </div>
      )}
    </div>
  );
};

export default ActivityFeedWidget;

import { Clock } from 'lucide-react';

const formatTime = (value) => {
  if (!value) return '';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return '';
  }
};

const ActivityFeedWidget = ({ activity = [], loading = false }) => {
  return (
    <div className="bg-base-100 rounded-xl border border-base-content/10 shadow-sm p-4 mb-4">
      <div className="flex items-center gap-2 mb-3">
        <Clock size={16} className="text-brand-vibrant" />
        <h3 className="text-sm font-black text-base-content uppercase tracking-wider">Recent activity</h3>
      </div>
      {loading ? (
        <p className="text-sm text-base-content/50">Loading activity...</p>
      ) : activity.length > 0 ? (
        <div className="space-y-2">
          {activity.slice(0, 6).map((item) => (
            <div key={`${item.source}-${item.id}`} className="p-2 rounded-lg bg-base-200/50">
              <p className="text-sm font-bold text-base-content">{item.title || item.type}</p>
              {item.description && <p className="text-xs text-base-content/50 truncate">{item.description}</p>}
              <p className="text-[10px] text-base-content/40 mt-1">{formatTime(item.occurredAt)}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-base-content/50">No recent activity yet.</p>
      )}
    </div>
  );
};

export default ActivityFeedWidget;

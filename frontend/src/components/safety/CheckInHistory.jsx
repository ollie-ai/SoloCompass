import { useState, useEffect } from 'react';
import { History, CheckCircle, XCircle, AlertTriangle, MapPin } from 'lucide-react';
import api from '../../lib/api';

const TYPE_CONFIG = {
  manual: { label: 'Manual', color: 'text-success', icon: CheckCircle },
  emergency: { label: 'Emergency', color: 'text-error', icon: AlertTriangle },
  scheduled: { label: 'Scheduled', color: 'text-info', icon: CheckCircle },
  missed: { label: 'Missed', color: 'text-warning', icon: XCircle }
};

export default function CheckInHistory({ tripId, limit = 20 }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    fetchHistory(1);
  }, [tripId]);

  const fetchHistory = async (p = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: p, limit });
      if (tripId) params.set('tripId', tripId);
      const res = await api.get(`/checkin/history?${params}`);
      const items = res.data?.data || [];
      if (p === 1) {
        setHistory(items);
      } else {
        setHistory(prev => [...prev, ...items]);
      }
      setHasMore(items.length === limit);
      setPage(p);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  };

  if (loading && history.length === 0) {
    return (
      <div className="p-6 text-center text-base-content/60">
        <div className="animate-spin w-6 h-6 border-2 border-brand-vibrant border-t-transparent rounded-full mx-auto mb-2" />
        Loading history...
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="p-6 text-center text-base-content/60">
        <History size={32} className="mx-auto mb-3 opacity-30" />
        <p className="font-semibold">No check-in history yet</p>
        <p className="text-sm mt-1">Your check-ins will appear here once you start sending them.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {history.map((item) => {
        const cfg = TYPE_CONFIG[item.type] || TYPE_CONFIG.manual;
        const Icon = cfg.icon;
        return (
          <div key={item.id} className="flex items-start gap-3 p-3 rounded-xl bg-base-200/50 border border-base-300/40">
            <Icon size={16} className={`${cfg.color} mt-0.5 shrink-0`} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className={`text-xs font-black uppercase tracking-wide ${cfg.color}`}>{cfg.label}</span>
                <span className="text-[10px] text-base-content/50">
                  {new Date(item.createdAt || item.created_at).toLocaleString(undefined, {
                    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                  })}
                </span>
              </div>
              {(item.address || item.latitude) && (
                <p className="text-xs text-base-content/60 mt-0.5 flex items-center gap-1 truncate">
                  <MapPin size={10} />
                  {item.address || `${parseFloat(item.latitude).toFixed(4)}, ${parseFloat(item.longitude).toFixed(4)}`}
                </p>
              )}
              {item.message && (
                <p className="text-xs text-base-content/70 mt-0.5 truncate italic">"{item.message}"</p>
              )}
            </div>
          </div>
        );
      })}

      {hasMore && (
        <button
          onClick={() => fetchHistory(page + 1)}
          disabled={loading}
          className="w-full text-center text-xs text-brand-vibrant font-bold py-2 hover:underline disabled:opacity-50"
        >
          {loading ? 'Loading...' : 'Load more'}
        </button>
      )}
    </div>
  );
}

import { useState, useEffect } from 'react';
import { CheckCircle, Clock, AlertTriangle, XCircle, RefreshCw } from 'lucide-react';
import api from '../../lib/api';

const STATUS_CONFIG = {
  upcoming: { label: 'Upcoming', icon: Clock, color: 'text-info', bg: 'bg-info/10', border: 'border-info/30' },
  overdue: { label: 'Overdue', icon: AlertTriangle, color: 'text-warning', bg: 'bg-warning/10', border: 'border-warning/30' },
  missed: { label: 'Missed', icon: XCircle, color: 'text-error', bg: 'bg-error/10', border: 'border-error/30' },
  sos_triggered: { label: 'SOS Triggered', icon: AlertTriangle, color: 'text-error', bg: 'bg-error/20', border: 'border-error' },
  cancelled: { label: 'Cancelled', icon: XCircle, color: 'text-base-content/40', bg: 'bg-base-200', border: 'border-base-300' },
  confirmed: { label: 'Confirmed Safe', icon: CheckCircle, color: 'text-success', bg: 'bg-success/10', border: 'border-success/30' }
};

function timeUntil(dateStr) {
  const diff = new Date(dateStr) - Date.now();
  if (diff <= 0) return null;
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `in ${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `in ${hrs}h ${mins % 60}m`;
  return `in ${Math.floor(hrs / 24)}d`;
}

function formatTime(dateStr) {
  return new Date(dateStr).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
  });
}

export default function CheckInStatus({ tripId, onMissed }) {
  const [checkIns, setCheckIns] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchScheduled();
    const interval = setInterval(fetchScheduled, 60000);
    return () => clearInterval(interval);
  }, [tripId]);

  const fetchScheduled = async () => {
    try {
      const url = tripId ? `/checkin/scheduled?tripId=${tripId}` : '/checkin/scheduled';
      const res = await api.get(url);
      const list = res.data?.data || [];
      setCheckIns(list);
      // Notify parent if any are missed/overdue
      const missed = list.filter(c => c.missedAt || c.escalationLevel > 0);
      if (missed.length > 0) onMissed?.(missed[0]);
    } catch {
      // silently fail — this is a status widget
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-base-content/60 text-sm p-4">
        <RefreshCw size={14} className="animate-spin" />
        Loading check-in status...
      </div>
    );
  }

  if (checkIns.length === 0) {
    return (
      <div className="p-4 text-center text-base-content/60 text-sm">
        <Clock size={24} className="mx-auto mb-2 opacity-30" />
        No scheduled check-ins
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {checkIns.map((c) => {
        // Derive status
        let status = 'upcoming';
        if (!c.isActive) status = 'cancelled';
        else if (c.sosTriggered) status = 'sos_triggered';
        else if (c.missedAt) status = 'missed';
        else if (c.lastConfirmation) status = 'confirmed';
        else {
          const effectiveTime = c.nextCheckinTime || c.scheduledTime;
          if (new Date(effectiveTime) < new Date()) status = 'overdue';
        }

        const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.upcoming;
        const Icon = cfg.icon;
        const effectiveTime = c.nextCheckinTime || c.scheduledTime;
        const until = timeUntil(effectiveTime);

        return (
          <div key={c.id} className={`flex items-start gap-3 p-3 rounded-xl border ${cfg.bg} ${cfg.border}`}>
            <Icon size={16} className={`${cfg.color} mt-0.5 shrink-0`} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className={`text-xs font-black uppercase tracking-wide ${cfg.color}`}>{cfg.label}</span>
                {c.isRecurring && (
                  <span className="text-[10px] bg-brand-vibrant/10 text-brand-vibrant px-1.5 py-0.5 rounded-full font-bold">
                    {c.intervalMinutes === 1440 ? 'Daily' : c.intervalMinutes === 720 ? 'Every 12h' : `Every ${c.intervalMinutes}m`}
                  </span>
                )}
              </div>
              <p className="text-xs text-base-content/70 mt-0.5">
                {formatTime(effectiveTime)}
                {until && status === 'upcoming' && <span className="text-brand-vibrant ml-1">({until})</span>}
              </p>
              {c.missedCount > 0 && (
                <p className="text-xs text-error mt-0.5">Missed {c.missedCount}× — escalation level {c.escalationLevel}</p>
              )}
              {c.lastConfirmation && (
                <p className="text-xs text-success mt-0.5">
                  Confirmed {formatTime(c.lastConfirmation.created_at)}
                  {c.lastConfirmation.address && ` · ${c.lastConfirmation.address}`}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

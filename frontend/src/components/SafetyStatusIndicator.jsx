import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';

/**
 * SafetyStatusIndicator — persistent banner/badge that shows the user's
 * current check-in status and any active SOS alerts.
 *
 * Props:
 *  safetyData — { checkInScheduled, checkInSchedule, contacts }  (from Dashboard)
 */
export default function SafetyStatusIndicator({ safetyData }) {
  const [activeAlert, setActiveAlert] = useState(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const fetchAlerts = async () => {
      try {
        setChecking(true);
        const res = await api.get('/checkin/schedule');
        if (!cancelled) {
          const data = res.data?.data || res.data;
          // An active SOS is represented by an overdue check-in without a completed_at
          const missedCheckIn = Array.isArray(data?.schedule)
            ? data.schedule.find((s) => s.missed_at && !s.completed_at)
            : data?.missed_at && !data?.completed_at
            ? data
            : null;
          setActiveAlert(missedCheckIn || null);
        }
      } catch {
        // non-critical; fail silently
      } finally {
        if (!cancelled) setChecking(false);
      }
    };
    fetchAlerts();
    return () => { cancelled = true; };
  }, []);

  const { checkInScheduled, checkInSchedule } = safetyData || {};

  // Determine status
  const hasActiveSOS = !!activeAlert;
  const isOverdue =
    checkInSchedule?.scheduled_time &&
    !checkInSchedule?.completed_at &&
    new Date(checkInSchedule.scheduled_time) < new Date();

  let statusColor = 'bg-emerald-500';
  let statusLabel = 'Check-in: OK';
  let dotPulse = false;

  if (hasActiveSOS) {
    statusColor = 'bg-red-500';
    statusLabel = 'SOS Active';
    dotPulse = true;
  } else if (isOverdue) {
    statusColor = 'bg-amber-500';
    statusLabel = 'Check-in Overdue';
    dotPulse = true;
  } else if (checkInScheduled) {
    statusColor = 'bg-emerald-500';
    statusLabel = 'Check-in Scheduled';
  } else {
    statusColor = 'bg-base-content/20';
    statusLabel = 'No Check-in Set';
  }

  return (
    <Link
      to="/safety"
      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold
        bg-base-100 border border-base-content/10 shadow-sm hover:shadow transition-shadow
        focus:outline-none focus:ring-2 focus:ring-brand-vibrant/50"
      aria-label={`Safety status: ${statusLabel}. Click to manage safety settings.`}
    >
      <span
        className={`w-2.5 h-2.5 rounded-full ${statusColor} ${dotPulse ? 'animate-pulse' : ''}`}
      />
      <span className="text-base-content/80">{statusLabel}</span>
    </Link>
  );
}

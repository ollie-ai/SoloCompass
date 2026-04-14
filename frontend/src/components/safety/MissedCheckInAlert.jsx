import { useState, useEffect } from 'react';
import { AlertTriangle, Clock, Check, X } from 'lucide-react';
import api from '../../lib/api';
import toast from 'react-hot-toast';

function formatTimeDiff(since) {
  const diffMs = Date.now() - new Date(since).getTime();
  const mins = Math.floor(diffMs / 60000);
  const secs = Math.floor((diffMs % 60000) / 1000);
  return mins > 0 ? `${mins}m ${secs}s ago` : `${secs}s ago`;
}

export default function MissedCheckInAlert({ scheduledCheckIn, onConfirm, onSnooze }) {
  const [elapsed, setElapsed] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const update = () => {
      if (scheduledCheckIn?.scheduled_time || scheduledCheckIn?.scheduledTime) {
        setElapsed(formatTimeDiff(scheduledCheckIn.scheduled_time || scheduledCheckIn.scheduledTime));
      }
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [scheduledCheckIn]);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      const id = scheduledCheckIn?.id;
      await api.post(`/checkin/scheduled/${id}/confirm`, {});
      toast.success("Check-in confirmed. You're safe!");
      onConfirm?.();
    } catch (err) {
      toast.error('Failed to confirm check-in');
    } finally {
      setLoading(false);
    }
  };

  const handleSnooze = async (minutes) => {
    setLoading(true);
    try {
      const id = scheduledCheckIn?.id;
      await api.post(`/checkin/scheduled/${id}/snooze`, { minutes });
      toast.success(`Snoozed for ${minutes} minutes`);
      onSnooze?.(minutes);
    } catch (err) {
      toast.error('Failed to snooze check-in');
    } finally {
      setLoading(false);
    }
  };

  if (!scheduledCheckIn) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-error text-white shadow-2xl">
      <div className="max-w-md mx-auto">
        <div className="flex items-start gap-3 mb-4">
          <AlertTriangle size={24} className="shrink-0 mt-0.5 animate-pulse" />
          <div>
            <h3 className="font-black text-lg">Missed Check-In</h3>
            <p className="text-sm opacity-90">
              You missed your scheduled check-in
              {elapsed && <span className="ml-1 font-bold">({elapsed})</span>}.
            </p>
            <p className="text-xs opacity-80 mt-1">
              Your emergency contacts will be notified if you don't respond soon.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleConfirm}
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 bg-white text-error font-black py-3 rounded-xl text-sm uppercase tracking-wide hover:bg-red-50 transition-colors disabled:opacity-50"
          >
            <Check size={16} />
            I'm Safe
          </button>
          <button
            onClick={() => handleSnooze(15)}
            disabled={loading}
            className="flex items-center justify-center gap-2 bg-error-content/20 text-white border border-white/30 font-bold py-3 px-4 rounded-xl text-sm hover:bg-error-content/30 transition-colors disabled:opacity-50"
          >
            <Clock size={16} />
            Snooze 15m
          </button>
        </div>
      </div>
    </div>
  );
}

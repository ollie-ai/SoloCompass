import { useState, useEffect } from 'react';
import { Bell, Check, Clock, X } from 'lucide-react';
import api from '../../lib/api';
import toast from 'react-hot-toast';

/**
 * CheckInReminder — shown when a scheduled check-in is due within 15 minutes
 * or is overdue. Receives the pending check-in object.
 */
export default function CheckInReminder({ scheduledCheckIn, onDismiss }) {
  const [timeLeft, setTimeLeft] = useState('');
  const [isOverdue, setIsOverdue] = useState(false);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!scheduledCheckIn) return;
    const update = () => {
      const target = new Date(scheduledCheckIn.nextCheckinTime || scheduledCheckIn.scheduledTime);
      const diff = target - Date.now();
      if (diff <= 0) {
        setIsOverdue(true);
        const absDiff = Math.abs(diff);
        const mins = Math.floor(absDiff / 60000);
        const secs = Math.floor((absDiff % 60000) / 1000);
        setTimeLeft(`${mins}m ${secs}s overdue`);
      } else {
        setIsOverdue(false);
        const mins = Math.floor(diff / 60000);
        const secs = Math.floor((diff % 60000) / 1000);
        setTimeLeft(`${mins}m ${secs}s`);
      }
    };
    update();
    const iv = setInterval(update, 1000);
    return () => clearInterval(iv);
  }, [scheduledCheckIn]);

  const handleConfirm = async () => {
    setConfirming(true);
    try {
      await api.post(`/checkin/scheduled/${scheduledCheckIn.id}/confirm`, {});
      toast.success("Check-in confirmed. You're safe!");
      onDismiss?.();
    } catch {
      toast.error('Failed to confirm check-in');
    } finally {
      setConfirming(false);
    }
  };

  if (!scheduledCheckIn) return null;

  return (
    <div className={`rounded-2xl border p-4 ${
      isOverdue
        ? 'bg-error/10 border-error/40'
        : 'bg-warning/10 border-warning/40'
    }`}>
      <div className="flex items-start gap-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
          isOverdue ? 'bg-error/20' : 'bg-warning/20'
        }`}>
          <Bell size={18} className={isOverdue ? 'text-error animate-pulse' : 'text-warning'} />
        </div>
        <div className="flex-1">
          <p className={`font-black text-sm ${isOverdue ? 'text-error' : 'text-warning'}`}>
            {isOverdue ? 'Missed Check-In' : 'Check-In Due Soon'}
          </p>
          <p className="text-xs text-base-content/70 mt-0.5 flex items-center gap-1">
            <Clock size={11} />
            {timeLeft}
          </p>
          <p className="text-xs text-base-content/60 mt-1">
            {isOverdue
              ? 'Your emergency contacts will be notified if you don\'t respond.'
              : 'Confirm you\'re safe before the time expires.'}
          </p>
        </div>
        <button onClick={onDismiss} className="text-base-content/30 hover:text-base-content/60 transition-colors">
          <X size={16} />
        </button>
      </div>

      <div className="flex gap-2 mt-3">
        <button
          onClick={handleConfirm}
          disabled={confirming}
          className={`flex-1 flex items-center justify-center gap-2 font-black py-2.5 rounded-xl text-sm uppercase tracking-wide disabled:opacity-50 transition-all ${
            isOverdue
              ? 'bg-error text-white hover:bg-red-600'
              : 'bg-warning text-white hover:bg-amber-500'
          }`}
        >
          <Check size={14} />
          {confirming ? 'Confirming...' : "I'm Safe"}
        </button>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { Calendar, Clock, RefreshCw, Plus, ChevronDown } from 'lucide-react';
import api from '../../lib/api';
import toast from 'react-hot-toast';

const FREQUENCIES = [
  { value: 'one-time', label: 'One-time', description: 'Single check-in at a specific time' },
  { value: 'daily', label: 'Daily', description: 'Every 24 hours from the first check-in' },
  { value: '12h', label: 'Every 12 hours', description: 'Twice a day' },
  { value: '6h', label: 'Every 6 hours', description: 'Four times a day' },
  { value: '4h', label: 'Every 4 hours', description: 'Six times a day' },
  { value: 'custom', label: 'Custom interval', description: 'Set your own interval in minutes' }
];

export default function CheckInScheduler({ trips = [], onScheduled }) {
  const [form, setForm] = useState({
    tripId: trips[0]?.id || '',
    scheduledTime: '',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    frequency: 'one-time',
    intervalMinutes: 60
  });
  const [loading, setLoading] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Minimum datetime: now + 1 minute
  const minDateTime = new Date(Date.now() + 60000).toISOString().slice(0, 16);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.scheduledTime) {
      toast.error('Please select a scheduled time');
      return;
    }
    setLoading(true);
    try {
      const payload = {
        tripId: form.tripId || undefined,
        scheduledTime: new Date(form.scheduledTime).toISOString(),
        timezone: form.timezone,
        frequency: form.frequency,
        intervalMinutes: form.frequency === 'custom' ? parseInt(form.intervalMinutes) : undefined
      };
      const res = await api.post('/checkin/scheduled', payload);
      toast.success(
        form.frequency === 'one-time'
          ? 'Check-in scheduled'
          : `Recurring check-in set (${FREQUENCIES.find(f => f.value === form.frequency)?.label})`
      );
      onScheduled?.(res.data?.data);
      setForm(prev => ({ ...prev, scheduledTime: '' }));
    } catch (err) {
      const msg = err.response?.data?.error;
      if (typeof msg === 'object') {
        toast.error(msg.message || 'This feature requires an upgrade');
      } else {
        toast.error(msg || 'Failed to schedule check-in');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Date/time */}
      <div>
        <label className="block text-xs font-bold text-base-content/70 mb-1.5">
          <Calendar size={12} className="inline mr-1" />
          Check-in Time *
        </label>
        <input
          type="datetime-local"
          required
          min={minDateTime}
          value={form.scheduledTime}
          onChange={(e) => setForm({ ...form, scheduledTime: e.target.value })}
          className="w-full px-3 py-2.5 border border-base-300 rounded-xl bg-base-100 text-sm focus:outline-none focus:border-brand-vibrant"
        />
      </div>

      {/* Frequency */}
      <div>
        <label className="block text-xs font-bold text-base-content/70 mb-1.5">
          <RefreshCw size={12} className="inline mr-1" />
          Frequency
        </label>
        <div className="grid grid-cols-2 gap-2">
          {FREQUENCIES.filter(f => !showAdvanced ? ['one-time', 'daily', '12h'].includes(f.value) : true).map((freq) => (
            <button
              key={freq.value}
              type="button"
              onClick={() => setForm({ ...form, frequency: freq.value })}
              className={`p-2.5 rounded-xl border text-left transition-all ${
                form.frequency === freq.value
                  ? 'border-brand-vibrant bg-brand-vibrant/10 text-brand-vibrant'
                  : 'border-base-300 bg-base-100 text-base-content/70 hover:border-brand-vibrant/50'
              }`}
            >
              <p className="text-xs font-black">{freq.label}</p>
              <p className="text-[10px] opacity-70 mt-0.5">{freq.description}</p>
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-1 text-xs text-brand-vibrant mt-2 hover:underline"
        >
          <ChevronDown size={12} className={`transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
          {showAdvanced ? 'Show less' : 'More options'}
        </button>
      </div>

      {/* Custom interval */}
      {form.frequency === 'custom' && (
        <div>
          <label className="block text-xs font-bold text-base-content/70 mb-1.5">
            <Clock size={12} className="inline mr-1" />
            Interval (minutes)
          </label>
          <input
            type="number"
            min={15}
            max={10080}
            value={form.intervalMinutes}
            onChange={(e) => setForm({ ...form, intervalMinutes: e.target.value })}
            className="w-full px-3 py-2.5 border border-base-300 rounded-xl bg-base-100 text-sm focus:outline-none focus:border-brand-vibrant"
          />
          <p className="text-[10px] text-base-content/50 mt-1">Min 15 minutes, max 10080 (1 week)</p>
        </div>
      )}

      {/* Trip selector */}
      {trips.length > 1 && (
        <div>
          <label className="block text-xs font-bold text-base-content/70 mb-1.5">Link to Trip</label>
          <select
            value={form.tripId}
            onChange={(e) => setForm({ ...form, tripId: e.target.value })}
            className="w-full px-3 py-2.5 border border-base-300 rounded-xl bg-base-100 text-sm focus:outline-none focus:border-brand-vibrant"
          >
            <option value="">No specific trip</option>
            {trips.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
      )}

      <button
        type="submit"
        disabled={loading || !form.scheduledTime}
        className="w-full flex items-center justify-center gap-2 bg-brand-vibrant text-white font-black py-3 rounded-xl text-sm uppercase tracking-wide hover:opacity-90 disabled:opacity-50 transition-opacity"
      >
        <Plus size={16} />
        {loading ? 'Scheduling...' : 'Schedule Check-In'}
      </button>
    </form>
  );
}

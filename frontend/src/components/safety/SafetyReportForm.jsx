import { useState } from 'react';
import { Flag, AlertTriangle, Check } from 'lucide-react';
import api from '../../lib/api';
import toast from 'react-hot-toast';

const REPORT_TYPES = [
  { value: 'theft', label: 'Theft / Pickpocketing' },
  { value: 'harassment', label: 'Harassment' },
  { value: 'unsafe_area', label: 'Unsafe Area' },
  { value: 'scam', label: 'Scam' },
  { value: 'other', label: 'Other' }
];

const SEVERITY_OPTIONS = [
  { value: 'low', label: 'Low', color: 'text-success' },
  { value: 'medium', label: 'Medium', color: 'text-warning' },
  { value: 'high', label: 'High', color: 'text-error' }
];

export default function SafetyReportForm({ onSubmitted }) {
  const [form, setForm] = useState({
    reportType: '',
    description: '',
    severity: 'medium'
  });
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.reportType) {
      toast.error('Please select a report type');
      return;
    }
    setLoading(true);
    try {
      let latitude = null;
      let longitude = null;
      if (navigator.geolocation) {
        try {
          const pos = await new Promise((resolve, reject) =>
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 })
          );
          latitude = pos.coords.latitude;
          longitude = pos.coords.longitude;
        } catch {
          // location optional
        }
      }
      await api.post('/safety-areas/report', {
        reportType: form.reportType,
        description: form.description,
        severity: form.severity,
        latitude,
        longitude
      });
      setSubmitted(true);
      toast.success('Safety report submitted. Thank you!');
      onSubmitted?.();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to submit report');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="text-center py-4">
        <div className="w-10 h-10 bg-success/10 rounded-full flex items-center justify-center mx-auto mb-2">
          <Check size={20} className="text-success" />
        </div>
        <p className="font-bold text-base-content text-sm">Report submitted. Thank you for keeping the community safe!</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Flag size={16} className="text-warning" />
        <h4 className="font-black text-sm text-base-content">Report a Safety Issue</h4>
      </div>

      <div>
        <label className="block text-xs font-bold text-base-content/70 mb-1">Type of Incident *</label>
        <select
          value={form.reportType}
          onChange={(e) => setForm({ ...form, reportType: e.target.value })}
          required
          className="w-full px-3 py-2.5 border border-base-300 rounded-xl bg-base-100 text-sm focus:outline-none focus:border-brand-vibrant"
        >
          <option value="">Select incident type...</option>
          {REPORT_TYPES.map(({ value, label }) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs font-bold text-base-content/70 mb-1">Severity</label>
        <div className="flex gap-2">
          {SEVERITY_OPTIONS.map(({ value, label, color }) => (
            <button
              key={value}
              type="button"
              onClick={() => setForm({ ...form, severity: value })}
              className={`flex-1 py-2 rounded-xl border text-xs font-bold transition-all ${
                form.severity === value
                  ? `border-current ${color} bg-current/10`
                  : 'border-base-300 text-base-content/50 hover:border-base-400'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-xs font-bold text-base-content/70 mb-1">Description</label>
        <textarea
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          placeholder="Briefly describe what happened to help other travellers..."
          rows={3}
          className="w-full px-3 py-2 border border-base-300 rounded-xl bg-base-100 text-sm focus:outline-none focus:border-brand-vibrant resize-none"
        />
      </div>

      <div className="flex items-start gap-2 p-3 bg-base-200 rounded-xl">
        <AlertTriangle size={14} className="text-base-content/50 shrink-0 mt-0.5" />
        <p className="text-xs text-base-content/60">
          Your current location will be attached if you allow it. Reports are reviewed before being shown publicly.
        </p>
      </div>

      <button
        type="submit"
        disabled={loading || !form.reportType}
        className="w-full bg-warning text-white font-black py-2.5 rounded-xl text-sm uppercase tracking-wide hover:opacity-90 transition-opacity disabled:opacity-50"
      >
        {loading ? 'Submitting...' : 'Submit Report'}
      </button>
    </form>
  );
}

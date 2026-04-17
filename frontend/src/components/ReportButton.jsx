import { useState } from 'react';
import { Flag, AlertTriangle, Check, X, ChevronDown } from 'lucide-react';
import api from '../lib/api';
import { useAuthStore } from '../stores/authStore';
import toast from 'react-hot-toast';

const REASONS = [
  { value: 'spam', label: 'Spam or misleading' },
  { value: 'harassment', label: 'Harassment or abuse' },
  { value: 'inappropriate_content', label: 'Inappropriate content' },
  { value: 'false_information', label: 'False information' },
  { value: 'safety_concern', label: 'Safety concern' },
  { value: 'copyright', label: 'Copyright violation' },
  { value: 'other', label: 'Other' },
];

/**
 * ReportButton — renders a flag icon that opens an inline report dialog.
 *
 * Props:
 *   entityType  – 'user' | 'trip' | 'destination' | 'review' | 'content'
 *   entityId    – numeric ID of the entity being reported
 *   label       – optional button text (defaults to icon-only)
 *   className   – extra class names for the trigger button
 */
export default function ReportButton({ entityType, entityId, label, className = '' }) {
  const { isAuthenticated } = useAuthStore();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  if (!isAuthenticated) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!reason) {
      toast.error('Please select a reason');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/reports', {
        reportedEntityType: entityType,
        entityId,
        reason,
        details,
      });
      setDone(true);
      toast.success('Report submitted. Thank you.');
      setTimeout(() => {
        setOpen(false);
        setDone(false);
        setReason('');
        setDetails('');
      }, 2000);
    } catch (err) {
      const msg = err.response?.data?.error?.message || err.response?.data?.error || 'Failed to submit report';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center gap-1.5 text-xs text-base-content/50 hover:text-error transition-colors focus:outline-none focus:ring-2 focus:ring-error/30 rounded ${className}`}
        aria-label="Report this content"
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <Flag size={13} />
        {label && <span>{label}</span>}
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Report content"
          className="absolute right-0 z-50 mt-2 w-72 bg-base-100 border border-base-300/60 rounded-xl shadow-xl p-4"
        >
          {done ? (
            <div className="text-center py-4">
              <div className="w-10 h-10 rounded-full bg-green-100 text-green-600 flex items-center justify-center mx-auto mb-3">
                <Check size={20} />
              </div>
              <p className="text-sm font-semibold text-base-content">Report submitted</p>
              <p className="text-xs text-base-content/60 mt-1">We'll review it within 24 hours.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-bold text-base-content flex items-center gap-2">
                  <AlertTriangle size={14} className="text-error" />
                  Report Content
                </span>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="text-base-content/50 hover:text-base-content rounded focus:outline-none focus:ring-1 focus:ring-primary/40"
                  aria-label="Close report dialog"
                >
                  <X size={14} />
                </button>
              </div>

              <div className="mb-3">
                <label className="block text-xs font-semibold text-base-content/70 mb-1.5" htmlFor="report-reason">
                  Reason <span aria-hidden="true">*</span>
                </label>
                <div className="relative">
                  <select
                    id="report-reason"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    required
                    className="w-full text-sm bg-base-200 border border-base-300 rounded-lg px-3 py-2 pr-8 appearance-none focus:outline-none focus:ring-2 focus:ring-primary/30"
                    aria-required="true"
                  >
                    <option value="">Select a reason…</option>
                    {REASONS.map((r) => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-base-content/40" aria-hidden="true" />
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-xs font-semibold text-base-content/70 mb-1.5" htmlFor="report-details">
                  Additional details (optional)
                </label>
                <textarea
                  id="report-details"
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  rows={3}
                  maxLength={500}
                  placeholder="Describe the issue…"
                  className="w-full text-sm bg-base-200 border border-base-300 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex-1 text-sm py-1.5 rounded-lg border border-base-300 hover:bg-base-200 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !reason}
                  className="flex-1 text-sm py-1.5 rounded-lg bg-error text-white hover:bg-error/90 transition-colors disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-error/40"
                >
                  {submitting ? 'Submitting…' : 'Submit Report'}
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}

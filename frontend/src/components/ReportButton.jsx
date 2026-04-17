import { useState } from 'react';
import { Flag } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../lib/api';

export default function ReportButton({ reportedEntityType = 'content', entityId, compact = false }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('spam');
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!entityId) return;
    setSubmitting(true);
    try {
      await api.post('/v1/reports', { reportedEntityType, entityId, reason, details });
      toast.success('Report submitted');
      setOpen(false);
      setDetails('');
    } catch (error) {
      toast.error(error?.response?.data?.error || 'Failed to submit report');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={compact ? 'text-xs text-base-content/60 hover:text-error' : 'inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-base-300 hover:border-error/40'}
      >
        <Flag size={14} />
        <span>Report</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-[90] bg-black/50 flex items-center justify-center p-4">
          <form onSubmit={submit} className="w-full max-w-md bg-base-100 rounded-xl p-6 border border-base-300 space-y-4">
            <h3 className="text-lg font-black">Report content</h3>
            <select value={reason} onChange={(e) => setReason(e.target.value)} className="w-full px-3 py-2 border border-base-300 rounded-lg">
              <option value="spam">Spam</option>
              <option value="abuse">Abuse</option>
              <option value="safety">Safety concern</option>
              <option value="other">Other</option>
            </select>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Additional details (optional)"
              className="w-full h-24 px-3 py-2 border border-base-300 rounded-lg"
            />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setOpen(false)} className="px-4 py-2 rounded-lg border border-base-300">Cancel</button>
              <button type="submit" disabled={submitting} className="px-4 py-2 rounded-lg bg-error text-white disabled:opacity-60">
                {submitting ? 'Submitting...' : 'Submit report'}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

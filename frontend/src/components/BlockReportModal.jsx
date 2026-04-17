import { useState } from 'react';
import { Flag, Shield, X } from 'lucide-react';

const REPORT_REASONS = [
  'Harassment',
  'Spam',
  'Inappropriate content',
  'Impersonation',
  'Safety concern',
  'Other'
];

const BlockReportModal = ({ open, userName, loading = false, onClose, onBlock, onReport }) => {
  const [reason, setReason] = useState(REPORT_REASONS[0]);
  const [details, setDetails] = useState('');

  if (!open) return null;

  const handleReport = () => {
    onReport?.({ reason, details: details.trim() || undefined });
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-2xl bg-base-100 border border-base-300 p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-black text-base-content">Safety actions for {userName || 'this user'}</h3>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-base-200">
            <X size={16} className="text-base-content/60" />
          </button>
        </div>

        <div className="space-y-3 mb-5">
          <label className="block text-sm font-bold text-base-content/70">Report reason</label>
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full rounded-xl border border-base-300 bg-base-100 px-3 py-2 text-sm"
          >
            {REPORT_REASONS.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
          <textarea
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            rows={4}
            maxLength={2000}
            placeholder="Additional details (optional)"
            className="w-full rounded-xl border border-base-300 bg-base-100 px-3 py-2 text-sm"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            disabled={loading}
            onClick={handleReport}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-warning text-white font-bold text-sm hover:opacity-90 disabled:opacity-50"
          >
            <Flag size={16} /> Report user
          </button>
          <button
            disabled={loading}
            onClick={onBlock}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-error text-white font-bold text-sm hover:opacity-90 disabled:opacity-50"
          >
            <Shield size={16} /> Block user
          </button>
        </div>
      </div>
    </div>
  );
};

export default BlockReportModal;

import { useMemo, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';

export default function AccountDeletionModal({ isOpen, isDeleting, onClose, onConfirm }) {
  const [confirmationText, setConfirmationText] = useState('');
  const canConfirm = useMemo(() => confirmationText.trim().toUpperCase() === 'DELETE', [confirmationText]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-base-100 rounded-2xl border border-base-300 shadow-2xl">
        <div className="p-5 border-b border-base-300 flex items-center justify-between">
          <h3 className="text-lg font-black text-error flex items-center gap-2">
            <AlertTriangle size={18} />
            Confirm account deletion
          </h3>
          <button onClick={onClose} aria-label="Close" disabled={isDeleting} className="p-2 rounded-lg hover:bg-base-200 disabled:opacity-40">
            <X size={16} />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <p id="account-delete-help" className="text-sm text-base-content/80">
            This permanently deletes your account and associated data. Type <span className="font-black">DELETE</span> to continue.
          </p>
          <label htmlFor="account-delete-confirm" className="text-xs font-bold text-base-content/60 uppercase tracking-wide">
            Confirmation text
          </label>
          <input
            id="account-delete-confirm"
            aria-describedby="account-delete-help"
            value={confirmationText}
            onChange={(e) => setConfirmationText(e.target.value)}
            placeholder="Type DELETE to confirm"
            className="w-full px-3 py-2 rounded-lg border border-base-300 bg-base-100 focus:outline-none focus:ring-2 focus:ring-error/40"
          />
          <div className="flex gap-2 justify-end">
            <button onClick={onClose} disabled={isDeleting} className="px-4 py-2 rounded-lg border border-base-300 text-base-content/70 font-bold disabled:opacity-50">
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={!canConfirm || isDeleting}
              className="px-4 py-2 rounded-lg bg-error text-white font-black disabled:opacity-50"
            >
              {isDeleting ? 'Deleting...' : 'Delete account'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

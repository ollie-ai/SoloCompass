import { useState } from 'react';
import { AlertTriangle, Trash2, Loader } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import toast from 'react-hot-toast';

export default function AccountDeletionFlow() {
  const [step, setStep] = useState(0); // 0=button, 1=confirm1, 2=confirm2
  const [confirmText, setConfirmText] = useState('');
  const [loading, setLoading] = useState(false);
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleDelete = async () => {
    if (confirmText !== 'DELETE') {
      toast.error('Please type DELETE to confirm');
      return;
    }
    setLoading(true);
    try {
      await api.delete(`/users/${user.id}`);
      await logout();
      navigate('/');
      toast.success('Account deletion requested. Your account will be permanently deleted in 30 days.');
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to delete account');
    } finally {
      setLoading(false);
    }
  };

  if (step === 0) {
    return (
      <button onClick={() => setStep(1)} className="btn btn-error btn-outline btn-sm gap-2">
        <Trash2 className="w-4 h-4" />
        Delete Account
      </button>
    );
  }

  if (step === 1) {
    return (
      <div className="border border-error/30 rounded-lg p-4 space-y-3">
        <div className="flex items-center gap-2 text-error">
          <AlertTriangle className="w-5 h-5" />
          <h3 className="font-semibold">Delete Your Account?</h3>
        </div>
        <p className="text-sm text-base-content/70">This will begin a 30-day deletion process. Your data will be permanently removed after 30 days. You can cancel before then by contacting support.</p>
        <ul className="text-sm text-base-content/60 list-disc list-inside space-y-1">
          <li>All trips and itineraries will be deleted</li>
          <li>Your profile and travel data will be removed</li>
          <li>Any active subscriptions will be cancelled</li>
          <li>This cannot be reversed after the 30-day window</li>
        </ul>
        <div className="flex gap-2">
          <button onClick={() => setStep(2)} className="btn btn-error btn-sm">Yes, I want to delete</button>
          <button onClick={() => setStep(0)} className="btn btn-ghost btn-sm">Cancel</button>
        </div>
      </div>
    );
  }

  return (
    <div className="border border-error/30 rounded-lg p-4 space-y-3">
      <div className="flex items-center gap-2 text-error">
        <AlertTriangle className="w-5 h-5" />
        <h3 className="font-semibold">Final Confirmation</h3>
      </div>
      <p className="text-sm text-base-content/70">Type <strong>DELETE</strong> to confirm account deletion:</p>
      <input
        type="text"
        className="input input-bordered input-error w-full"
        placeholder="Type DELETE here"
        value={confirmText}
        onChange={e => setConfirmText(e.target.value)}
      />
      <div className="flex gap-2">
        <button onClick={handleDelete} disabled={loading || confirmText !== 'DELETE'} className="btn btn-error btn-sm gap-2">
          {loading ? <Loader className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
          Delete My Account
        </button>
        <button onClick={() => { setStep(0); setConfirmText(''); }} className="btn btn-ghost btn-sm">Cancel</button>
      </div>
    </div>
  );
}

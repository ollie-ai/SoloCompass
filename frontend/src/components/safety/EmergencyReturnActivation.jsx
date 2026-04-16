import { useState } from 'react';
import { AlertTriangle, Shield, CheckCircle, X, Loader } from 'lucide-react';
import api from '../../lib/api';
import toast from 'react-hot-toast';

const STAGES = {
  idle: 'idle',
  confirm: 'confirm',
  activating: 'activating',
  activated: 'activated'
};

export default function EmergencyReturnActivation({ plan, onActivated, onCancel }) {
  const [stage, setStage] = useState(STAGES.idle);

  if (!plan?.id) return null;

  const handleActivate = async () => {
    setStage(STAGES.activating);
    try {
      await api.post(`/return-plan/${plan.id}/activate`);
      setStage(STAGES.activated);
      toast.success('Emergency return plan activated. Your guardians have been notified.');
      onActivated?.();
    } catch (err) {
      setStage(STAGES.confirm);
      toast.error(err.response?.data?.error || 'Failed to activate return plan');
    }
  };

  if (stage === STAGES.activated) {
    return (
      <div className="rounded-2xl border border-success/40 bg-success/10 p-5 text-center">
        <CheckCircle size={32} className="text-success mx-auto mb-3" />
        <p className="font-black text-base-content text-base">Plan Activated</p>
        <p className="text-sm text-base-content/70 mt-1">
          Your guardians have been notified of your emergency return plan.
        </p>
      </div>
    );
  }

  if (stage === STAGES.confirm || stage === STAGES.activating) {
    return (
      <div className="rounded-2xl border border-error/50 bg-error/10 p-5">
        <div className="flex items-start gap-3 mb-4">
          <AlertTriangle size={22} className="text-error shrink-0 mt-0.5" />
          <div>
            <p className="font-black text-error text-base">Activate Emergency Return?</p>
            <p className="text-sm text-base-content/70 mt-1">
              This will immediately notify all your guardians with your return plan details. Only do this in a genuine emergency.
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleActivate}
            disabled={stage === STAGES.activating}
            className="flex-1 flex items-center justify-center gap-2 bg-error text-white font-black py-3 rounded-xl text-sm uppercase tracking-wide hover:bg-red-600 disabled:opacity-70 transition-colors"
          >
            {stage === STAGES.activating ? (
              <><Loader size={15} className="animate-spin" /> Activating...</>
            ) : (
              <><AlertTriangle size={15} /> Confirm Activation</>
            )}
          </button>
          <button
            onClick={() => { setStage(STAGES.idle); onCancel?.(); }}
            disabled={stage === STAGES.activating}
            className="flex items-center justify-center gap-1 border border-base-300 text-base-content/70 font-bold px-4 py-3 rounded-xl text-sm hover:bg-base-200 disabled:opacity-50"
          >
            <X size={14} /> Cancel
          </button>
        </div>
      </div>
    );
  }

  // idle state — just the trigger button
  return (
    <button
      onClick={() => setStage(STAGES.confirm)}
      className="w-full flex items-center justify-center gap-2 bg-error text-white font-black py-3 rounded-xl text-sm uppercase tracking-wide hover:bg-red-600 transition-colors shadow-lg shadow-error/25"
    >
      <Shield size={16} />
      🚨 Emergency Return
    </button>
  );
}

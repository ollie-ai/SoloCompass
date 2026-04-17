import { X, Crown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import PropTypes from 'prop-types';

export function UpgradePromptModal({ isOpen, onClose, feature, requiredPlan = 'guardian' }) {
  const navigate = useNavigate();
  if (!isOpen) return null;

  const planName = requiredPlan.charAt(0).toUpperCase() + requiredPlan.slice(1);
  const price = requiredPlan === 'navigator' ? '£9.99' : '£4.99';

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-base-100 rounded-2xl border border-base-300/50 shadow-2xl w-full max-w-sm p-6 space-y-4">
        <button onClick={onClose} className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-base-200 text-base-content/40">
          <X size={16} />
        </button>
        <div className="w-12 h-12 bg-brand-vibrant/10 rounded-2xl flex items-center justify-center">
          <Crown size={24} className="text-brand-vibrant" />
        </div>
        <div>
          <h3 className="text-lg font-black text-base-content">Upgrade to {planName}</h3>
          <p className="text-sm text-base-content/60 font-medium mt-1">
            {feature ? `"${feature}" requires ${planName}.` : `This feature requires the ${planName} plan.`}
          </p>
        </div>
        <div className="flex gap-2 pt-2">
          <button
            onClick={() => { navigate(`/checkout?plan=${requiredPlan}`); onClose(); }}
            className="flex-1 py-2.5 bg-brand-vibrant text-white rounded-xl font-bold text-sm hover:bg-emerald-600 transition-colors"
          >
            Upgrade — {price}/mo
          </button>
          <button onClick={onClose} className="px-4 py-2.5 border border-base-300 rounded-xl font-bold text-sm hover:bg-base-200 transition-colors">
            Later
          </button>
        </div>
      </div>
    </div>
  );
}

UpgradePromptModal.propTypes = {
  isOpen: PropTypes.bool,
  onClose: PropTypes.func,
  feature: PropTypes.string,
  requiredPlan: PropTypes.string,
};

export default UpgradePromptModal;

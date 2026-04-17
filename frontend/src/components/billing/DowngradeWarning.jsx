import { AlertTriangle, X } from 'lucide-react';

const TIER_FEATURES = {
  navigator: [
    'AI Destination Chat',
    'AI Safety Advice',
    'Travel Buddy Matching',
    'Unlimited AI Chat Messages',
  ],
  guardian: [
    'Scheduled Check-ins',
    'Missed Check-in Alerts',
    'Safe-Return Timer',
    'Safe Haven Locator',
    'Unlimited Active Trips',
    'Unlimited AI Itineraries',
  ],
};

function getFeaturesLost(currentTier, targetTier) {
  const tiers = ['explorer', 'guardian', 'navigator'];
  const currentIdx = tiers.indexOf(currentTier);
  const targetIdx = tiers.indexOf(targetTier);
  const lost = [];

  for (let i = currentIdx; i > targetIdx; i--) {
    const tier = tiers[i];
    if (TIER_FEATURES[tier]) {
      lost.push(...TIER_FEATURES[tier]);
    }
  }
  return lost;
}

export default function DowngradeWarning({ currentTier, targetTier, onConfirm, onCancel }) {
  const featuresLost = getFeaturesLost(currentTier, targetTier);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="glass-card bg-base-100 rounded-3xl border border-base-300/50 max-w-md w-full p-0 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-warning/10 rounded-xl flex items-center justify-center">
              <AlertTriangle size={20} className="text-warning" />
            </div>
            <h3 className="text-lg font-black text-base-content font-outfit">
              Downgrade Plan?
            </h3>
          </div>
          <button
            onClick={onCancel}
            className="w-8 h-8 rounded-full bg-base-200 flex items-center justify-center hover:bg-base-300 transition-colors"
          >
            <X size={16} className="text-base-content/60" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 pb-6">
          <p className="text-sm text-base-content/60 font-medium mb-4">
            Switching from <span className="font-black text-base-content capitalize">{currentTier}</span> to{' '}
            <span className="font-black text-base-content capitalize">{targetTier}</span> means you'll lose
            access to:
          </p>

          <div className="bg-warning/5 border border-warning/20 rounded-2xl p-4 space-y-2.5 mb-6">
            {featuresLost.map((feature) => (
              <div key={feature} className="flex items-center gap-3 text-sm">
                <div className="w-5 h-5 bg-warning/10 rounded-full flex items-center justify-center shrink-0">
                  <X size={12} className="text-warning stroke-[3px]" />
                </div>
                <span className="font-medium text-base-content/80">{feature}</span>
              </div>
            ))}
          </div>

          <p className="text-xs text-base-content/40 font-medium mb-6">
            Your current features remain active until the end of your billing period.
          </p>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="flex-1 py-3 rounded-2xl font-black text-sm bg-brand-deep text-white hover:bg-black transition-all active:scale-95 shadow-lg shadow-brand-deep/20"
            >
              Keep Current Plan
            </button>
            <button
              onClick={onConfirm}
              className="flex-1 py-3 rounded-2xl font-black text-sm bg-base-200 text-base-content/60 hover:bg-base-300 transition-all active:scale-95"
            >
              Downgrade
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

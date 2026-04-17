import { memo } from 'react';
import PropTypes from 'prop-types';
import { FEATURES, FEATURE_LABELS } from '../config/features';
import { Lock } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { hasMinimumTier } from '../lib/subscriptionAccess';

function FeatureGate({ 
  feature, 
  children, 
  showComingSoon = true,
  adminPreview = false,
  requiredTier = null,
  lockReason = null,
}) {
  const user = useAuthStore((state) => state.user);
  const isEnabled = FEATURES[feature];
  const featureLabel = FEATURE_LABELS[feature] || feature;
  const hasRequiredTier = requiredTier ? hasMinimumTier(user, requiredTier) : true;
  const isUnlocked = (isEnabled || adminPreview) && hasRequiredTier;

  if (isUnlocked) {
    return <>{children}</>;
  }

  if (!showComingSoon) {
    return null;
  }

  return (
    <div className="relative group cursor-not-allowed">
      <div className="absolute inset-0 bg-base-200/80 backdrop-blur-[1px] rounded-xl z-10 flex flex-col items-center justify-center">
        <div className="flex items-center gap-2 px-4 py-2 bg-base-200 rounded-full border border-base-300">
          <Lock size={14} className="text-base-content/40" />
          <span className="text-xs font-black uppercase tracking-widest text-base-content/60">
            {requiredTier ? `Requires ${requiredTier}` : 'Coming Soon'}
          </span>
        </div>
        <p className="mt-3 text-sm font-medium text-base-content/40 max-w-[200px] text-center">
          {lockReason || (requiredTier
            ? `${featureLabel} is available on ${requiredTier} and above`
            : `${featureLabel} feature is under development`)}
        </p>
      </div>
      <div className="opacity-50 pointer-events-none">
        {children}
      </div>
    </div>
  );
}

FeatureGate.propTypes = {
  feature: PropTypes.string.isRequired,
  children: PropTypes.node,
  showComingSoon: PropTypes.bool,
  adminPreview: PropTypes.bool,
  requiredTier: PropTypes.oneOf(['explorer', 'guardian', 'navigator']),
  lockReason: PropTypes.string,
};

FeatureGate.defaultProps = {
  children: null,
  showComingSoon: true,
  adminPreview: false,
  requiredTier: null,
  lockReason: null,
};

export default memo(FeatureGate);

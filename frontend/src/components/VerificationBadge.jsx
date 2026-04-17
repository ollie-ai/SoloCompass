import { memo } from 'react';
import PropTypes from 'prop-types';
import { ShieldCheck, Shield } from 'lucide-react';

const TIERS = {
  none: { icon: null, label: null, color: '' },
  email: { icon: Shield, label: 'Email Verified', color: 'text-blue-500' },
  id: { icon: ShieldCheck, label: 'ID Verified', color: 'text-emerald-500' },
  full: { icon: ShieldCheck, label: 'Fully Verified', color: 'text-amber-500' },
};

const sizeMap = { sm: 'w-4 h-4', md: 'w-5 h-5', lg: 'w-6 h-6' };

const VerificationBadge = memo(function VerificationBadge({ tier = 'none', size = 'sm', showLabel = false }) {
  const config = TIERS[tier] || TIERS.none;
  if (!config.icon) return null;

  const Icon = config.icon;

  return (
    <span className={`inline-flex items-center gap-1 ${config.color}`} title={config.label}>
      <Icon className={sizeMap[size] || sizeMap.sm} />
      {showLabel && <span className="text-xs font-medium">{config.label}</span>}
    </span>
  );
});

VerificationBadge.displayName = 'VerificationBadge';

VerificationBadge.propTypes = {
  tier: PropTypes.oneOf(['none', 'email', 'id', 'full']),
  size: PropTypes.oneOf(['sm', 'md', 'lg']),
  showLabel: PropTypes.bool,
};

export default VerificationBadge;

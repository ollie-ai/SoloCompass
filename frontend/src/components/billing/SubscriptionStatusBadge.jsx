import { Crown, Zap, Shield } from 'lucide-react';
import PropTypes from 'prop-types';

const TIER_CONFIG = {
  explorer: { label: 'Explorer', icon: Zap, className: 'bg-base-300/60 text-base-content/60' },
  guardian: { label: 'Guardian', icon: Shield, className: 'bg-emerald-500/15 text-emerald-600' },
  navigator: { label: 'Navigator', icon: Crown, className: 'bg-purple-500/15 text-purple-500' },
  free: { label: 'Explorer', icon: Zap, className: 'bg-base-300/60 text-base-content/60' },
};

export function SubscriptionStatusBadge({ tier = 'explorer', status, size = 'sm' }) {
  const config = TIER_CONFIG[tier] || TIER_CONFIG.explorer;
  const Icon = config.icon;

  const sizes = {
    xs: 'px-1.5 py-0.5 text-[9px] gap-1',
    sm: 'px-2 py-0.5 text-[10px] gap-1',
    md: 'px-2.5 py-1 text-xs gap-1.5',
  };

  const pastDue = status === 'past_due';
  const trialing = status === 'trialing';

  return (
    <span
      className={`inline-flex items-center font-black uppercase tracking-wider rounded-full ${sizes[size] || sizes.sm} ${
        pastDue
          ? 'bg-error/15 text-error'
          : trialing
          ? 'bg-amber-500/15 text-amber-600'
          : config.className
      }`}
    >
      <Icon size={size === 'xs' ? 8 : 10} />
      {pastDue ? 'Past Due' : trialing ? `${config.label} Trial` : config.label}
    </span>
  );
}

SubscriptionStatusBadge.propTypes = {
  tier: PropTypes.string,
  status: PropTypes.string,
  size: PropTypes.oneOf(['xs', 'sm', 'md']),
};

export default SubscriptionStatusBadge;

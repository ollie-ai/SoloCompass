import { Link } from 'react-router-dom';
import { Lock, Sparkles, ArrowRight } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { hasMinimumTier } from '../lib/subscriptionAccess';

const PLAN_LABELS = { explorer: 'Explorer', guardian: 'Guardian', navigator: 'Navigator' };
const PLAN_COLORS = {
  guardian: 'from-amber-500/10 to-base-100 border-amber-500/30',
  navigator: 'from-purple-500/10 to-base-100 border-purple-500/30',
  explorer: 'from-primary/5 to-base-100 border-primary/20',
};
const ICON_COLORS = {
  guardian: 'bg-amber-500/10 text-amber-500',
  navigator: 'bg-purple-500/10 text-purple-500',
  explorer: 'bg-primary/10 text-primary',
};

/**
 * UpgradePrompt — inline upsell shown when a user accesses a locked feature.
 *
 * Props:
 *   minPlan     – required plan tier ('guardian' | 'navigator')
 *   feature     – short feature name displayed in the prompt
 *   description – optional description
 *   children    – content shown when user already has access
 *   compact     – renders a smaller pill-style prompt
 */
export default function UpgradePrompt({
  minPlan = 'guardian',
  feature,
  description,
  children,
  compact = false,
}) {
  const { user, isAuthenticated } = useAuthStore();

  // If user has access, render children
  if (isAuthenticated && hasMinimumTier(user, minPlan)) {
    return children ?? null;
  }

  const planLabel = PLAN_LABELS[minPlan] || minPlan;
  const gradientClasses = PLAN_COLORS[minPlan] || PLAN_COLORS.explorer;
  const iconClasses = ICON_COLORS[minPlan] || ICON_COLORS.explorer;

  if (compact) {
    return (
      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-amber-500/30 bg-amber-500/5 text-xs font-semibold text-amber-600">
        <Lock size={11} aria-hidden="true" />
        <span>{planLabel}+ required</span>
        <Link
          to="/settings?tab=billing"
          className="underline hover:no-underline focus:outline-none focus:ring-1 focus:ring-amber-400 rounded"
          aria-label={`Upgrade to ${planLabel} plan`}
        >
          Upgrade
        </Link>
      </div>
    );
  }

  return (
    <div
      className={`rounded-2xl border bg-gradient-to-br ${gradientClasses} p-5`}
      role="region"
      aria-label={`${planLabel} plan required`}
    >
      <div className="flex items-start gap-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${iconClasses}`} aria-hidden="true">
          <Sparkles size={17} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-black text-base-content">
            {feature ? `${feature} — ` : ''}{planLabel}+ Plan
          </p>
          <p className="text-xs text-base-content/60 mt-0.5 leading-snug">
            {description || `Upgrade to ${planLabel} or above to unlock this feature.`}
          </p>
        </div>
      </div>
      <Link
        to={isAuthenticated ? '/settings?tab=billing' : '/register'}
        className="mt-4 flex items-center justify-center gap-1.5 w-full py-2 rounded-xl text-xs font-bold bg-primary/10 text-primary hover:bg-primary/20 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40"
        aria-label={`Upgrade to ${planLabel} plan`}
      >
        {isAuthenticated ? `Upgrade to ${planLabel}` : 'Sign up free'}
        <ArrowRight size={13} aria-hidden="true" />
      </Link>
    </div>
  );
}

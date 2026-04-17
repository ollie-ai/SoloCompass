import { useState, useEffect } from 'react';
import { Crown, Calendar, BarChart3, CreditCard, ArrowUpRight, Sparkles, Shield, Compass } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../../lib/api';

const PLAN_META = {
  explorer: { name: 'Explorer', icon: Compass, colorClass: 'text-base-content/60', bgClass: 'bg-slate-500/10' },
  guardian: { name: 'Guardian', icon: Shield, colorClass: 'text-brand-vibrant', bgClass: 'bg-brand-vibrant/10' },
  navigator: { name: 'Navigator', icon: Crown, colorClass: 'text-indigo-500', bgClass: 'bg-indigo-500/10' },
};

function UsageBar({ label, used, limit, unit = '' }) {
  const isUnlimited = limit === 'Unlimited' || limit === -1;
  const percentage = isUnlimited ? Math.min((used / 100) * 100, 100) : Math.min((used / limit) * 100, 100);
  const displayLimit = isUnlimited ? '∞' : limit;
  const isNearLimit = !isUnlimited && percentage >= 80;

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-bold text-base-content/60">{label}</span>
        <span className={`text-xs font-black ${isNearLimit ? 'text-warning' : 'text-base-content/40'}`}>
          {used}{unit} / {displayLimit}{unit && !isUnlimited ? unit : ''}
        </span>
      </div>
      <div className="h-2 bg-base-200 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            isNearLimit ? 'bg-warning' : 'bg-brand-vibrant'
          }`}
          style={{ width: `${isUnlimited ? Math.min(used, 30) : percentage}%` }}
        />
      </div>
    </div>
  );
}

export default function CurrentPlanCard() {
  const [subscription, setSubscription] = useState(null);
  const [usage, setUsage] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      try {
        const [subRes, usageRes] = await Promise.all([
          api.get('/billing/subscription-status'),
          api.get('/billing/usage'),
        ]);
        if (!cancelled) {
          setSubscription(subRes.data);
          setUsage(usageRes.data);
        }
      } catch {
        // Silently fail — card shows fallback state
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchData();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="glass-card p-6 rounded-3xl border border-base-300/50 animate-pulse">
        <div className="h-6 bg-base-200 rounded-lg w-1/3 mb-4" />
        <div className="h-4 bg-base-200 rounded-lg w-2/3 mb-3" />
        <div className="h-4 bg-base-200 rounded-lg w-1/2" />
      </div>
    );
  }

  const tier = subscription?.tier || 'explorer';
  const plan = PLAN_META[tier] || PLAN_META.explorer;
  const Icon = plan.icon;
  const isTrial = subscription?.status === 'trialing';
  const isFreePlan = tier === 'explorer';

  const renewalDate = subscription?.current_period_end
    ? new Date(subscription.current_period_end).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : null;

  const trialEnd = subscription?.trial_end
    ? new Date(subscription.trial_end).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : null;

  return (
    <div className="glass-card p-6 rounded-3xl border border-base-300/50">
      {/* Plan Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 ${plan.bgClass} rounded-xl flex items-center justify-center`}>
            <Icon size={20} className={plan.colorClass} />
          </div>
          <div>
            <h3 className="font-black text-base-content font-outfit uppercase tracking-wider">
              {plan.name}
            </h3>
            <p className="text-[10px] font-bold text-base-content/40 uppercase tracking-widest">
              {isTrial ? 'Trial Active' : isFreePlan ? 'Free Tier' : 'Active Subscription'}
            </p>
          </div>
        </div>
        {!isFreePlan && subscription?.interval && (
          <span className="text-[10px] font-black uppercase tracking-widest bg-base-200 text-base-content/60 px-2.5 py-1 rounded-full">
            {subscription.interval === 'year' ? 'Annual' : 'Monthly'}
          </span>
        )}
      </div>

      {/* Trial Banner */}
      {isTrial && trialEnd && (
        <div className="bg-brand-vibrant/5 border border-brand-vibrant/20 rounded-2xl p-4 mb-6">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles size={14} className="text-brand-vibrant" />
            <span className="text-xs font-black text-brand-vibrant uppercase tracking-widest">
              Trial Period
            </span>
          </div>
          <p className="text-sm text-base-content/60 font-medium">
            Your trial ends on <span className="font-bold text-base-content">{trialEnd}</span>.
            You'll be billed automatically after.
          </p>
        </div>
      )}

      {/* Renewal / Billing Info */}
      {!isFreePlan && renewalDate && (
        <div className="flex items-center gap-3 text-sm text-base-content/60 mb-6">
          <Calendar size={16} className="shrink-0" />
          <span className="font-medium">
            Renews <span className="font-bold text-base-content">{renewalDate}</span>
          </span>
        </div>
      )}

      {/* Usage Section */}
      {usage && (
        <div className="space-y-4 mb-6 pt-4 border-t border-base-300/50">
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 size={14} className="text-base-content/40" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-base-content/40">
              Usage This Period
            </span>
          </div>

          {usage.aiItineraries !== undefined && (
            <UsageBar
              label="AI Itineraries"
              used={usage.aiItineraries?.used ?? 0}
              limit={usage.aiItineraries?.limit ?? 1}
            />
          )}

          {usage.aiMessages !== undefined && (
            <UsageBar
              label="AI Chat Messages"
              used={usage.aiMessages?.used ?? 0}
              limit={usage.aiMessages?.limit ?? 5}
            />
          )}

          {usage.activeTrips !== undefined && (
            <UsageBar
              label="Active Trips"
              used={usage.activeTrips?.used ?? 0}
              limit={usage.activeTrips?.limit ?? 2}
            />
          )}
        </div>
      )}

      {/* Upgrade CTA (free plan) */}
      {isFreePlan && (
        <Link
          to="/pricing"
          className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl font-black text-sm bg-brand-deep text-white hover:bg-black transition-all active:scale-95 shadow-lg shadow-brand-deep/20"
        >
          Upgrade Plan
          <ArrowUpRight size={16} />
        </Link>
      )}

      {/* Manage Billing (paid plan) */}
      {!isFreePlan && (
        <Link
          to="/settings?tab=billing"
          className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl font-black text-xs uppercase tracking-widest bg-base-200 text-base-content/60 hover:bg-base-300 transition-all active:scale-95"
        >
          <CreditCard size={14} />
          Manage Billing
        </Link>
      )}
    </div>
  );
}

import { useState, useEffect } from 'react';
import { Check, X, Crown, Shield, Compass } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../lib/api';

const FEATURES = [
  { name: 'Travel DNA Quiz', explorer: true, guardian: true, navigator: true },
  { name: 'Active Trips', explorer: '2', guardian: 'Unlimited', navigator: 'Unlimited' },
  { name: 'AI Itineraries/month', explorer: '1', guardian: 'Unlimited', navigator: 'Unlimited' },
  { name: 'Edit Itinerary Activities', explorer: true, guardian: true, navigator: true },
  { name: 'Manual Safety Check-ins', explorer: true, guardian: true, navigator: true },
  { name: 'SOS Emergency Alert', explorer: true, guardian: true, navigator: true },
  { name: 'Official Advisories (FCDO)', explorer: true, guardian: true, navigator: true },
  { name: 'Scheduled Check-ins', explorer: false, guardian: true, navigator: true },
  { name: 'Missed Check-in Alerts', explorer: false, guardian: true, navigator: true },
  { name: 'Safe-Return Timer', explorer: false, guardian: true, navigator: true },
  { name: 'Safe Haven Locator', explorer: false, guardian: true, navigator: true },
  { name: 'AI Destination Chat', explorer: false, guardian: false, navigator: true },
  { name: 'AI Safety Advice', explorer: false, guardian: false, navigator: true },
  { name: 'Travel Buddy Matching', explorer: false, guardian: false, navigator: true },
  { name: 'AI Chat Messages/month', explorer: '5', guardian: '20', navigator: 'Unlimited' },
];

const PLANS = [
  {
    id: 'explorer',
    name: 'Explorer',
    icon: Compass,
    price: { monthly: 0, annual: 0 },
    colorClass: 'text-base-content/60',
    bgClass: 'bg-slate-500/10',
    headerClass: 'text-base-content/40',
  },
  {
    id: 'guardian',
    name: 'Guardian',
    icon: Shield,
    price: { monthly: 4.99, annual: 3.99 },
    colorClass: 'text-brand-vibrant',
    bgClass: 'bg-brand-vibrant/10',
    headerClass: 'text-brand-vibrant',
    popular: true,
  },
  {
    id: 'navigator',
    name: 'Navigator',
    icon: Crown,
    price: { monthly: 9.99, annual: 7.99 },
    colorClass: 'text-indigo-500',
    bgClass: 'bg-indigo-500/10',
    headerClass: 'text-indigo-500',
  },
];

const TIER_RANK = { explorer: 0, guardian: 1, navigator: 2 };

function CellValue({ value, colorClass }) {
  if (value === true) {
    return (
      <div className={`w-5 h-5 ${colorClass === 'text-brand-vibrant' ? 'bg-brand-vibrant/10' : colorClass === 'text-indigo-500' ? 'bg-indigo-500/10' : 'bg-base-200'} rounded-full flex items-center justify-center mx-auto`}>
        <Check size={12} className={`${colorClass} stroke-[4px]`} />
      </div>
    );
  }
  if (value === false) {
    return (
      <div className="w-5 h-5 bg-base-200 rounded-full flex items-center justify-center mx-auto opacity-40">
        <X size={12} className="text-base-content/40 stroke-[3px]" />
      </div>
    );
  }
  return <span className={`text-xs font-black ${colorClass}`}>{value}</span>;
}

export default function PlanComparison({ currentTier = 'explorer' }) {
  const navigate = useNavigate();
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const fetchSubscription = async () => {
      try {
        const res = await api.get('/billing/subscription-status');
        if (!cancelled && res.data) {
          setSubscription(res.data);
        }
      } catch {
        // Use prop fallback
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchSubscription();
    return () => { cancelled = true; };
  }, []);

  const activeTier = subscription?.tier || currentTier;

  const handlePlanAction = (planId) => {
    if (planId === activeTier) return;
    const targetRank = TIER_RANK[planId];
    const currentRank = TIER_RANK[activeTier];

    if (targetRank > currentRank) {
      navigate(`/checkout?plan=${planId}`);
    } else {
      navigate(`/settings?tab=billing&downgrade=${planId}`);
    }
  };

  const getButtonLabel = (planId) => {
    if (planId === activeTier) return 'Current Plan';
    return TIER_RANK[planId] > TIER_RANK[activeTier] ? 'Upgrade' : 'Downgrade';
  };

  const getButtonClass = (planId) => {
    if (planId === activeTier) {
      return 'btn-disabled bg-base-200 text-base-content/40 cursor-default';
    }
    if (TIER_RANK[planId] > TIER_RANK[activeTier]) {
      return 'bg-brand-deep text-white hover:bg-black shadow-lg shadow-brand-deep/20';
    }
    return 'bg-base-200 text-base-content/60 hover:bg-base-300';
  };

  return (
    <div className="glass-card p-0 rounded-3xl border border-base-300/50 overflow-hidden">
      {/* Header */}
      <div className="p-6 pb-0">
        <h3 className="text-lg font-black text-base-content font-outfit uppercase tracking-wider mb-1">
          Plan Comparison
        </h3>
        <p className="text-sm text-base-content/60 font-medium">
          Compare features across all tiers.
        </p>
      </div>

      {/* Table */}
      <div className="overflow-x-auto p-6">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-base-300">
              <th className="py-4 pr-4 text-xs font-black uppercase tracking-[0.2em] text-base-content/40 w-2/5">
                Feature
              </th>
              {PLANS.map((plan) => {
                const Icon = plan.icon;
                return (
                  <th key={plan.id} className={`py-4 px-4 text-center ${plan.headerClass}`}>
                    <div className="flex flex-col items-center gap-1.5">
                      <div className={`w-8 h-8 ${plan.bgClass} rounded-lg flex items-center justify-center`}>
                        <Icon size={16} className={plan.colorClass} />
                      </div>
                      <span className="text-xs font-black uppercase tracking-[0.15em]">
                        {plan.name}
                      </span>
                      {plan.id === activeTier && (
                        <span className="text-[9px] font-black uppercase tracking-widest bg-brand-vibrant/10 text-brand-vibrant px-2 py-0.5 rounded-full">
                          Current
                        </span>
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-base-200/60">
            {FEATURES.map((feature) => (
              <tr key={feature.name} className="hover:bg-base-200/30 transition-colors">
                <td className="py-3.5 pr-4 text-sm font-bold text-base-content/80">
                  {feature.name}
                </td>
                {PLANS.map((plan) => (
                  <td key={plan.id} className="py-3.5 px-4 text-center">
                    <CellValue value={feature[plan.id]} colorClass={plan.colorClass} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-3 gap-4 p-6 pt-2 border-t border-base-300/50">
        {PLANS.map((plan) => (
          <button
            key={plan.id}
            onClick={() => handlePlanAction(plan.id)}
            disabled={plan.id === activeTier}
            className={`py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 ${getButtonClass(plan.id)}`}
          >
            {getButtonLabel(plan.id)}
          </button>
        ))}
      </div>
    </div>
  );
}

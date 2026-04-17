import { useState, useEffect } from 'react';
import { Sparkles, Zap, TrendingUp, AlertTriangle } from 'lucide-react';
import api from '../lib/api';

const PLAN_LABELS = { explorer: 'Explorer', guardian: 'Guardian', navigator: 'Navigator' };

export default function TokenDashboard() {
  const [usage, setUsage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.get('/ai/usage')
      .then(r => setUsage(r.data?.data || r.data))
      .catch(() => setError('Unable to load usage data'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="card bg-base-100 border border-base-200 p-5 animate-pulse">
        <div className="h-4 bg-base-200 rounded w-1/3 mb-4" />
        <div className="h-3 bg-base-200 rounded w-full mb-2" />
        <div className="h-3 bg-base-200 rounded w-2/3" />
      </div>
    );
  }

  if (error || !usage) {
    return (
      <div className="card bg-base-100 border border-base-200 p-5">
        <p className="text-sm text-base-content/50">{error || 'No usage data available'}</p>
      </div>
    );
  }

  const chatUsed = usage.chat ?? 0;
  const chatLimit = usage.limits?.chat ?? (usage.plan === 'explorer' ? 5 : Infinity);
  const itinUsed = usage.itinerary ?? 0;
  const itinLimit = usage.limits?.itinerary ?? (usage.plan === 'explorer' ? 1 : Infinity);
  const isUnlimited = usage.plan !== 'explorer';

  const chatPct = isUnlimited ? 0 : Math.min(100, (chatUsed / chatLimit) * 100);
  const itinPct = isUnlimited ? 0 : Math.min(100, (itinUsed / itinLimit) * 100);
  const nearLimit = !isUnlimited && (chatPct >= 80 || itinPct >= 80);

  return (
    <div className="card bg-base-100 border border-base-200 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-brand-vibrant" />
          <span className="text-sm font-bold text-base-content">AI Usage</span>
        </div>
        <span className="badge badge-sm badge-outline">{PLAN_LABELS[usage.plan] ?? usage.plan}</span>
      </div>

      {isUnlimited ? (
        <div className="flex items-center gap-2 text-sm text-base-content/60">
          <Zap size={14} className="text-emerald-500" />
          Unlimited AI on your plan
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <div className="flex justify-between text-xs text-base-content/60 mb-1">
              <span>Chat messages</span>
              <span>{chatUsed} / {chatLimit}</span>
            </div>
            <div className="w-full bg-base-200 rounded-full h-1.5">
              <div
                className={`h-1.5 rounded-full transition-all ${chatPct >= 80 ? 'bg-warning' : 'bg-brand-vibrant'}`}
                style={{ width: `${chatPct}%` }}
              />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-xs text-base-content/60 mb-1">
              <span>Itineraries</span>
              <span>{itinUsed} / {itinLimit}</span>
            </div>
            <div className="w-full bg-base-200 rounded-full h-1.5">
              <div
                className={`h-1.5 rounded-full transition-all ${itinPct >= 80 ? 'bg-warning' : 'bg-brand-vibrant'}`}
                style={{ width: `${itinPct}%` }}
              />
            </div>
          </div>

          {nearLimit && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-warning/10 border border-warning/20">
              <AlertTriangle size={14} className="text-warning mt-0.5 shrink-0" />
              <p className="text-xs text-base-content/70">
                You're nearing your monthly AI limit.{' '}
                <a href="/settings?tab=billing" className="underline font-semibold">Upgrade</a> for unlimited access.
              </p>
            </div>
          )}
        </div>
      )}

      {usage.plan === 'explorer' && (
        <a
          href="/settings?tab=billing"
          className="flex items-center gap-2 text-xs text-brand-vibrant font-semibold hover:underline"
        >
          <TrendingUp size={13} />
          Upgrade for unlimited AI
        </a>
      )}
    </div>
  );
}

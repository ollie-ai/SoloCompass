import { useState, useEffect } from 'react';
import { Zap, TrendingUp, AlertCircle, ArrowUpRight, MessageSquare, Globe, Sparkles } from 'lucide-react';
import api from '../lib/api';
import Skeleton from './Skeleton';

/**
 * TokenDashboard — AI usage stats card with progress bars and upgrade prompt.
 *
 * Shows the user's current AI token / request usage against their plan limit.
 * Wired into the Settings billing tab.
 *
 * Props:
 *   className – extra classes for the outer container
 *   onUpgrade  – optional callback fired when the "Upgrade" button is clicked
 */
export default function TokenDashboard({ className = '', onUpgrade }) {
  const [usage, setUsage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchUsage = async () => {
      try {
        const res = await api.get('/ai/usage');
        setUsage(res.data.data || res.data);
      } catch (err) {
        console.error('[TokenDashboard] Failed to fetch AI usage:', err);
        setError('Could not load AI usage data.');
      } finally {
        setLoading(false);
      }
    };

    fetchUsage();
  }, []);

  if (loading) {
    return (
      <div className={`glass-card p-6 rounded-2xl border border-base-300/50 space-y-4 ${className}`}>
        <Skeleton className="h-5 w-40 mb-2" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-4/5" />
      </div>
    );
  }

  if (error) {
    return (
      <div className={`glass-card p-6 rounded-2xl border border-error/20 flex items-start gap-3 ${className}`}>
        <AlertCircle size={18} className="text-error mt-0.5 shrink-0" />
        <p className="text-sm text-base-content/60">{error}</p>
      </div>
    );
  }

  const metrics = [
    {
      label: 'AI Chat Messages',
      icon: MessageSquare,
      used: usage?.chat_requests_used ?? 0,
      limit: usage?.chat_requests_limit ?? null,
      color: 'bg-brand-vibrant',
    },
    {
      label: 'Translation Requests',
      icon: Globe,
      used: usage?.translation_requests_used ?? 0,
      limit: usage?.translation_requests_limit ?? null,
      color: 'bg-indigo-500',
    },
    {
      label: 'AI Itinerary Generations',
      icon: Sparkles,
      used: usage?.itinerary_generations_used ?? 0,
      limit: usage?.itinerary_generations_limit ?? null,
      color: 'bg-amber-500',
    },
  ];

  const isAtLimit = metrics.some((m) => m.limit !== null && m.used >= m.limit);

  return (
    <div className={`glass-card p-6 rounded-2xl border border-base-300/50 space-y-5 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-brand-vibrant/10 flex items-center justify-center">
            <Zap size={16} className="text-brand-vibrant" />
          </div>
          <div>
            <p className="text-[11px] font-black uppercase tracking-widest text-base-content/40">AI Usage</p>
            <p className="text-sm font-black text-base-content">This Month</p>
          </div>
        </div>
        {usage?.reset_date && (
          <p className="text-[11px] font-bold text-base-content/40">
            Resets {new Date(usage.reset_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
          </p>
        )}
      </div>

      <div className="space-y-4">
        {metrics.map(({ label, icon: Icon, used, limit, color }) => {
          const pct = limit ? Math.min((used / limit) * 100, 100) : null;
          const nearLimit = pct !== null && pct >= 80;
          return (
            <div key={label} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Icon size={13} className="text-base-content/40" />
                  <p className="text-xs font-bold text-base-content/70">{label}</p>
                </div>
                <p className={`text-xs font-black ${nearLimit ? 'text-warning' : 'text-base-content/50'}`}>
                  {used.toLocaleString()}{limit ? ` / ${limit.toLocaleString()}` : ''}
                </p>
              </div>
              {pct !== null ? (
                <div className="w-full bg-base-200 rounded-full h-1.5">
                  <div
                    className={`h-1.5 rounded-full transition-all ${nearLimit ? 'bg-warning' : color}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              ) : (
                <div className="w-full bg-base-200 rounded-full h-1.5">
                  <div className={`h-1.5 rounded-full ${color} opacity-30`} style={{ width: '100%' }} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {isAtLimit && onUpgrade && (
        <div className="pt-2 border-t border-base-300/50">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-warning">
              <TrendingUp size={12} className="inline mr-1" />
              You've reached your plan limit
            </p>
            <button
              onClick={onUpgrade}
              className="flex items-center gap-1 text-[11px] font-black text-brand-vibrant hover:underline"
            >
              Upgrade <ArrowUpRight size={12} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

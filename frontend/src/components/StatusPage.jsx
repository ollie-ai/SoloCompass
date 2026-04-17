import { useState, useEffect } from 'react';
import { CheckCircle, AlertTriangle, AlertCircle, Clock, RefreshCw, Activity } from 'lucide-react';

const SERVICES = [
  { id: 'api', label: 'API' },
  { id: 'auth', label: 'Authentication' },
  { id: 'ai', label: 'AI Services' },
  { id: 'billing', label: 'Billing' },
  { id: 'notifications', label: 'Notifications' },
];

const STATUS_CONFIG = {
  operational: { label: 'Operational', color: 'text-green-600', bg: 'bg-green-100', icon: CheckCircle },
  degraded:    { label: 'Degraded',    color: 'text-amber-600', bg: 'bg-amber-100', icon: AlertTriangle },
  outage:      { label: 'Outage',      color: 'text-red-600',   bg: 'bg-red-100',   icon: AlertCircle },
  maintenance: { label: 'Maintenance', color: 'text-sky-600',   bg: 'bg-sky-100',   icon: Clock },
};

/**
 * StatusPage — shows system status and any current incidents.
 * Used by the /status route and can be embedded in other pages.
 *
 * Props:
 *   compact   – render a small inline status indicator
 *   className – extra classes for the outer container
 */
export default function StatusPage({ compact = false, className = '' }) {
  const [services, setServices] = useState(
    SERVICES.map((s) => ({ ...s, status: 'operational' }))
  );
  const [overall, setOverall] = useState('operational');
  const [lastChecked, setLastChecked] = useState(null);
  const [loading, setLoading] = useState(false);

  const checkStatus = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/health');
      const apiOk = res.ok;
      setServices((prev) =>
        prev.map((s) => ({
          ...s,
          status: s.id === 'api' && !apiOk ? 'outage' : 'operational',
        }))
      );
      setOverall(apiOk ? 'operational' : 'degraded');
    } catch {
      setOverall('degraded');
    } finally {
      setLastChecked(new Date());
      setLoading(false);
    }
  };

  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 60_000);
    return () => clearInterval(interval);
  }, []);

  const overallCfg = STATUS_CONFIG[overall] || STATUS_CONFIG.operational;
  const OverallIcon = overallCfg.icon;

  if (compact) {
    return (
      <div className={`inline-flex items-center gap-2 text-xs font-semibold ${className}`} role="status">
        <span className={`w-2 h-2 rounded-full ${overall === 'operational' ? 'bg-green-500' : overall === 'degraded' ? 'bg-amber-500' : 'bg-red-500'}`} aria-hidden="true" />
        <span className={overallCfg.color}>{overallCfg.label}</span>
      </div>
    );
  }

  return (
    <div className={`bg-base-100 rounded-2xl border border-base-300/50 shadow-sm overflow-hidden ${className}`} role="region" aria-label="System status">
      {/* Header */}
      <div className={`px-6 py-4 flex items-center justify-between ${overallCfg.bg} border-b border-base-200/60`}>
        <div className="flex items-center gap-3">
          <OverallIcon size={22} className={overallCfg.color} aria-hidden="true" />
          <div>
            <h2 className="text-base font-black text-base-content">System Status</h2>
            <p className={`text-xs font-semibold ${overallCfg.color}`}>{overallCfg.label}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={checkStatus}
          disabled={loading}
          className="p-2 rounded-lg text-base-content/40 hover:text-primary hover:bg-primary/10 transition-colors disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-primary/30"
          aria-label="Refresh status"
        >
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} aria-hidden="true" />
        </button>
      </div>

      {/* Services list */}
      <ul className="divide-y divide-base-200/60" role="list" aria-label="Service statuses">
        {services.map((svc) => {
          const cfg = STATUS_CONFIG[svc.status] || STATUS_CONFIG.operational;
          const SvcIcon = cfg.icon;
          return (
            <li key={svc.id} className="flex items-center justify-between px-6 py-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-base-content">
                <Activity size={14} className="text-base-content/30" aria-hidden="true" />
                {svc.label}
              </div>
              <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}>
                <SvcIcon size={11} aria-hidden="true" />
                {cfg.label}
              </span>
            </li>
          );
        })}
      </ul>

      {/* Footer */}
      {lastChecked && (
        <div className="px-6 py-2 text-xs text-base-content/40 border-t border-base-200/60" role="contentinfo">
          Last checked: <time dateTime={lastChecked.toISOString()}>{lastChecked.toLocaleTimeString()}</time>
        </div>
      )}
    </div>
  );
}

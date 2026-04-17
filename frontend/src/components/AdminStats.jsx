import { useState, useEffect } from 'react';
import { TrendingUp, Users, MapPin, DollarSign, Activity, Zap, BarChart2 } from 'lucide-react';
import api from '../lib/api';

// SVG sparkline chart for time-series data
function TrendChart({ title, points = [], valueKey = 'value', color = '#0ea5e9', formatValue }) {
  const safePoints = Array.isArray(points) ? points : [];
  const values = safePoints.map((p) => Number(p?.[valueKey] ?? 0));
  const max = Math.max(1, ...values);
  const min = Math.min(...values, 0);
  const range = Math.max(1, max - min);
  const W = 300;
  const H = 80;

  const coords = safePoints.map((point, i) => {
    const x = safePoints.length <= 1 ? W / 2 : (i / (safePoints.length - 1)) * W;
    const y = H - (((Number(point?.[valueKey] ?? 0) - min) / range) * (H - 4));
    return `${x},${y}`;
  }).join(' ');

  const latest = values[values.length - 1] ?? 0;
  const prev = values[values.length - 2] ?? latest;
  const delta = latest - prev;
  const deltaSign = delta >= 0 ? '+' : '';
  const formattedLatest = formatValue ? formatValue(latest) : latest;

  return (
    <div className="p-4 bg-base-100 rounded-xl border border-base-300">
      <div className="flex items-center justify-between mb-1">
        <p className="text-sm font-bold text-base-content">{title}</p>
        <span className={`text-xs font-black ${delta >= 0 ? 'text-success' : 'text-error'}`}>
          {deltaSign}{delta} <span className="text-base-content/30 font-normal">vs prev</span>
        </span>
      </div>
      <p className="text-2xl font-black text-base-content mb-2">{formattedLatest}</p>
      {safePoints.length > 1 ? (
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-16" preserveAspectRatio="none">
          <defs>
            <linearGradient id={`grad-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.15" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          <polyline
            fill={`url(#grad-${color.replace('#', '')})`}
            stroke="none"
            points={`0,${H} ${coords} ${W},${H}`}
          />
          <polyline fill="none" stroke={color} strokeWidth="2.5" points={coords} strokeLinejoin="round" strokeLinecap="round" />
        </svg>
      ) : (
        <div className="h-16 flex items-center justify-center text-xs text-base-content/30">No trend data yet</div>
      )}
      {safePoints.length > 0 && (
        <div className="flex justify-between mt-1">
          <span className="text-[10px] text-base-content/30">{safePoints[0]?.day?.slice(5) ?? ''}</span>
          <span className="text-[10px] text-base-content/30">{safePoints[safePoints.length - 1]?.day?.slice(5) ?? ''}</span>
        </div>
      )}
    </div>
  );
}

function StatCard({ title, value, icon: Icon, subtitle, trend, color = 'primary' }) {
  const colorMap = {
    success: { bg: 'bg-success/10', text: 'text-success' },
    warning: { bg: 'bg-warning/10', text: 'text-warning' },
    error:   { bg: 'bg-error/10',   text: 'text-error'   },
    info:    { bg: 'bg-info/10',    text: 'text-info'    },
    primary: { bg: 'bg-primary/10', text: 'text-primary' },
  };
  const { bg, text } = colorMap[color] || colorMap.primary;

  return (
    <div className="bg-base-100 rounded-xl shadow-sm border border-base-300 p-5 hover:shadow-md transition-all group">
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-black text-base-content/40 uppercase tracking-widest mb-1">{title}</p>
          <div className="flex items-baseline gap-2">
            <p className="text-2xl font-black text-base-content tracking-tight">{value}</p>
            {trend != null && (
              <span className="text-[10px] font-bold text-success">+{trend}</span>
            )}
          </div>
          {subtitle && <p className="text-xs text-base-content/50 mt-1 font-medium truncate">{subtitle}</p>}
        </div>
        <div className={`w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-110 ${bg} ${text}`}>
          <Icon size={20} />
        </div>
      </div>
    </div>
  );
}

const TIER_COLORS = { explorer: '#6366f1', guardian: '#0ea5e9', navigator: '#10b981' };
const TIER_PRICES_GBP = { explorer: 0, guardian: 4.99, navigator: 9.99 };

function AdminStats({ period = '30d' }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [analyticsPeriod, setAnalyticsPeriod] = useState(period);

  useEffect(() => {
    async function fetchStats() {
      try {
        setLoading(true);
        const response = await api.get(`/admin/analytics/overview?period=${analyticsPeriod}`);
        if (response.data.success) {
          setStats(response.data.data);
        }
      } catch (err) {
        setError(err.response?.data?.error?.message || err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, [analyticsPeriod]);

  const periodOptions = [
    { value: '7d',  label: '7d'  },
    { value: '30d', label: '30d' },
    { value: '90d', label: '90d' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-error/10 text-error rounded-xl border border-error/20 text-sm">
        Failed to load analytics: {error}
      </div>
    );
  }

  const mrrEstimate = stats?.revenueBreakdown?.estimatedMrr ?? 0;
  const topEvents = stats?.engagement?.topEventTypes ?? [];
  const maxEventCount = Math.max(1, ...topEvents.map((e) => e.count));

  return (
    <div className="space-y-6">
      {/* Period selector */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-black text-base-content">Platform Intelligence</h2>
        <div className="flex gap-1 bg-base-200 p-1 rounded-xl border border-base-300">
          {periodOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setAnalyticsPeriod(opt.value)}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                analyticsPeriod === opt.value
                  ? 'bg-base-100 text-primary shadow-sm'
                  : 'text-base-content/50 hover:text-base-content'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Top stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Users"
          value={(stats?.totalUsers ?? 0).toLocaleString()}
          icon={Users}
          color="primary"
        />
        <StatCard
          title="Active Trips"
          value={(stats?.activeTrips ?? 0).toLocaleString()}
          subtitle={`of ${(stats?.totalTrips ?? 0).toLocaleString()} total`}
          icon={MapPin}
          color="info"
        />
        <StatCard
          title="Est. MRR"
          value={`£${mrrEstimate.toFixed(2)}`}
          subtitle={`${(stats?.revenueBreakdown?.paidUsers ?? 0)} paid users`}
          icon={DollarSign}
          color="success"
        />
        <StatCard
          title="30d Active Users"
          value={(stats?.engagement?.activeUsers30d ?? 0).toLocaleString()}
          subtitle={`${(stats?.engagement?.activeUsers7d ?? 0).toLocaleString()} in last 7d`}
          icon={Activity}
          color="warning"
        />
      </div>

      {/* Time-series trend charts */}
      <div>
        <h3 className="text-sm font-black text-base-content/60 uppercase tracking-widest mb-3 flex items-center gap-2">
          <TrendingUp size={14} /> Trends — {stats?.period ?? analyticsPeriod}
        </h3>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <TrendChart
            title="User signups"
            points={stats?.timeSeries?.users ?? []}
            valueKey="value"
            color="#6366f1"
          />
          <TrendChart
            title="Trip creations"
            points={stats?.timeSeries?.trips ?? []}
            valueKey="value"
            color="#0ea5e9"
          />
          <TrendChart
            title="Daily engagement events"
            points={stats?.timeSeries?.engagement ?? []}
            valueKey="events"
            color="#f59e0b"
          />
        </div>
      </div>

      {/* Revenue breakdown by tier */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-base-100 rounded-xl shadow-sm border border-base-300 p-6">
          <h3 className="text-sm font-black text-base-content/60 uppercase tracking-widest mb-4 flex items-center gap-2">
            <BarChart2 size={14} /> Revenue breakdown by tier
          </h3>
          {(stats?.revenueBreakdown?.byTier ?? []).length > 0 ? (
            <div className="space-y-3">
              {stats.revenueBreakdown.byTier.map((row) => {
                const maxMrr = Math.max(1, ...stats.revenueBreakdown.byTier.map((r) => r.mrr));
                const pct = Math.round((row.mrr / maxMrr) * 100);
                const color = TIER_COLORS[row.tier] ?? '#6366f1';
                return (
                  <div key={row.tier}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-bold text-base-content capitalize">{row.tier}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-base-content/50">{row.users} users × £{TIER_PRICES_GBP[row.tier] ?? 0}/mo</span>
                        <span className="text-sm font-black" style={{ color }}>£{row.mrr.toFixed(2)}</span>
                      </div>
                    </div>
                    <div className="h-2 bg-base-200 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
                    </div>
                  </div>
                );
              })}
              <div className="pt-3 mt-3 border-t border-base-300 flex justify-between items-center">
                <span className="text-xs text-base-content/50 font-bold uppercase tracking-widest">Total Est. MRR</span>
                <span className="text-lg font-black text-success">£{mrrEstimate.toFixed(2)}</span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-base-content/40">No revenue data available</p>
          )}
        </div>

        {/* Subscriptions by tier */}
        <div className="bg-base-100 rounded-xl shadow-sm border border-base-300 p-6">
          <h3 className="text-sm font-black text-base-content/60 uppercase tracking-widest mb-4 flex items-center gap-2">
            <Users size={14} /> Subscriptions by tier
          </h3>
          <div className="space-y-3">
            {(stats?.subscriptionStats ?? []).length > 0 ? (
              stats.subscriptionStats.map((sub, idx) => {
                const total = stats.totalUsers || 1;
                const pct = Math.round(((sub.total ?? 0) / total) * 100);
                const color = TIER_COLORS[sub.tier?.toLowerCase()] ?? '#6366f1';
                return (
                  <div key={idx}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-bold text-base-content capitalize">{sub.tier ?? 'free'}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-base-content/40">{sub.active ?? 0} active</span>
                        <span className="text-sm font-black" style={{ color }}>{sub.total ?? 0}</span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-base-200 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-sm text-base-content/40">No subscription data</p>
            )}
          </div>
        </div>
      </div>

      {/* Engagement metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top event types */}
        <div className="bg-base-100 rounded-xl shadow-sm border border-base-300 p-6">
          <h3 className="text-sm font-black text-base-content/60 uppercase tracking-widest mb-4 flex items-center gap-2">
            <Zap size={14} /> Top engagement events
          </h3>
          {topEvents.length > 0 ? (
            <div className="space-y-2">
              {topEvents.map((e, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  <span className="text-xs font-mono text-base-content/50 w-4 text-right">{idx + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-xs font-bold text-base-content truncate">{e.event}</span>
                      <span className="text-xs font-black text-base-content/60 ml-2 flex-shrink-0">{e.count.toLocaleString()}</span>
                    </div>
                    <div className="h-1 bg-base-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-brand-vibrant rounded-full"
                        style={{ width: `${Math.round((e.count / maxEventCount) * 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-base-content/40">No event data for this period</p>
          )}
        </div>

        {/* Popular destinations */}
        <div className="bg-base-100 rounded-xl shadow-sm border border-base-300 p-6">
          <h3 className="text-sm font-black text-base-content/60 uppercase tracking-widest mb-4 flex items-center gap-2">
            <MapPin size={14} /> Popular destinations
          </h3>
          {(stats?.popularDestinations ?? []).length > 0 ? (
            <div className="space-y-2">
              {stats.popularDestinations.map((dest, idx) => {
                const maxTrips = Math.max(1, stats.popularDestinations[0]?.tripCount ?? 1);
                const pct = Math.round((dest.tripCount / maxTrips) * 100);
                return (
                  <div key={idx} className="flex items-center gap-3">
                    <span className="text-xs font-mono text-base-content/50 w-4 text-right">{idx + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-xs font-bold text-base-content truncate">{dest.name}</span>
                        <span className="text-xs font-black text-primary ml-2 flex-shrink-0">{dest.tripCount}</span>
                      </div>
                      <div className="h-1 bg-base-200 rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-base-content/40">No trips recorded</p>
          )}
        </div>
      </div>

      {/* Engagement summary row */}
      <div className="bg-base-100 rounded-xl shadow-sm border border-base-300 p-6">
        <h3 className="text-sm font-black text-base-content/60 uppercase tracking-widest mb-4 flex items-center gap-2">
          <Activity size={14} /> Engagement summary
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Active 7d', value: (stats?.engagement?.activeUsers7d ?? 0).toLocaleString(), color: 'text-info' },
            { label: 'Active 30d', value: (stats?.engagement?.activeUsers30d ?? 0).toLocaleString(), color: 'text-primary' },
            { label: `Events (${stats?.period ?? analyticsPeriod})`, value: (stats?.engagement?.eventsInPeriod ?? 0).toLocaleString(), color: 'text-warning' },
            { label: 'Avg events/user', value: stats?.engagement?.avgEventsPerActiveUser ?? 0, color: 'text-success' },
          ].map(({ label, value, color }) => (
            <div key={label} className="p-4 bg-base-200/40 rounded-xl border border-base-300/50 text-center">
              <p className={`text-xl font-black ${color}`}>{value}</p>
              <p className="text-[10px] text-base-content/50 uppercase tracking-widest mt-1 font-bold">{label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default AdminStats;

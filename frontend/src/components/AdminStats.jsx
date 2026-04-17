import { useState, useEffect } from 'react';
import api from '../lib/api';

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

  const [customRange, setCustomRange] = useState({ start: '', end: '' });
  
  const periodOptions = [
    { value: '7d', label: '7 Days' },
    { value: '30d', label: '30 Days' },
    { value: '90d', label: '90 Days' },
    { value: 'custom', label: 'Custom' }
  ];

  const handleCustomApply = () => {
    if (customRange.start && customRange.end) {
      setAnalyticsPeriod(`custom&start=${customRange.start}&end=${customRange.end}`);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-error/10 text-error rounded-xl border border-error/20">
        Failed to load analytics: {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end mb-4">
        <div className="flex gap-1 bg-base-200 p-1 rounded-xl border border-base-300">
          {periodOptions.map(opt => (
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Users"
          value={stats?.totalUsers || 0}
          icon="👥"
          trend={stats?.newUsersLastPeriod}
        />
        <StatCard
          title="Active Trips"
          value={stats?.activeTrips || 0}
          subtitle={`of ${stats?.totalTrips || 0} total`}
          icon="✈️"
        />
        <StatCard
          title="Monthly Revenue"
          value={`$${(stats?.revenue?.monthlyRecurring || 0).toLocaleString()}`}
          icon="💰"
          color="success"
        />
        <StatCard
          title="Churn Rate"
          value={`${stats?.churnRate || 0}%`}
          icon="📉"
          color="warning"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-base-100 rounded-xl shadow-sm border border-base-300 p-6">
          <h3 className="text-lg font-black text-base-content mb-4 tracking-tight">Subscriptions by Tier</h3>
          <div className="space-y-3">
            {stats?.subscriptionStats?.length > 0 ? (
              stats.subscriptionStats.map((sub, idx) => (
                <div key={idx} className="flex justify-between items-center p-3 bg-base-200/50 hover:bg-base-200 transition-colors rounded-xl border border-base-300/50">
                  <div>
                    <span className="font-bold text-base-content capitalize">{sub.tier || 'free'}</span>
                    <span className="text-xs text-base-content/50 ml-2">{sub.active} active</span>
                  </div>
                  <span className="text-primary font-black">{sub.total}</span>
                </div>
              ))
            ) : (
              <p className="text-base-content/40 text-sm">No subscriptions found</p>
            )}
          </div>
        </div>

        <div className="bg-base-100 rounded-xl shadow-sm border border-base-300 p-6">
          <h3 className="text-lg font-black text-base-content mb-4 tracking-tight">Popular Destinations</h3>
          <div className="space-y-3">
            {stats?.popularDestinations?.length > 0 ? (
              stats.popularDestinations.map((dest, idx) => (
                <div key={idx} className="flex justify-between items-center p-1.5 border-b border-base-300/50 last:border-0 hover:bg-base-200/30 transition-colors rounded-lg">
                  <span className="text-base-content/80 font-medium truncate max-w-[200px]">
                    {dest.name}
                  </span>
                  <div className="flex items-center gap-2">
                     <div className="h-1.5 w-16 bg-base-300 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-primary rounded-full" 
                          style={{ width: `${Math.min(100, (dest.tripCount / (stats.totalTrips || 1)) * 500)}%` }}
                        ></div>
                     </div>
                     <span className="text-primary font-bold text-sm w-12 text-right">{dest.tripCount}</span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-base-content/40 text-sm">No trips recorded</p>
            )}
          </div>
        </div>
      </div>

      {/* User Growth Bar Chart */}
      {stats?.newUsersByDay?.length > 0 && (
        <div className="bg-base-100 rounded-xl shadow-sm border border-base-300 p-6">
          <h3 className="text-lg font-black text-base-content mb-1 tracking-tight">New User Signups</h3>
          <p className="text-xs text-muted mb-5">Daily signups over the selected period</p>
          <UserGrowthChart data={stats.newUsersByDay} />
        </div>
      )}

      <div className="bg-base-100 rounded-xl shadow-sm border border-base-300 p-6">
        <h3 className="text-lg font-black text-base-content mb-4 tracking-tight">Financial Pulse</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-success/5 rounded-xl border border-success/10 group hover:bg-success/10 transition-all">
            <div className="text-xs font-bold text-success uppercase tracking-widest flex items-center gap-2">
               <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse"></div>
               Total Revenue
            </div>
            <p className="text-2xl font-black text-success mt-2">
              ${(stats?.revenue?.total || 0).toLocaleString()}
            </p>
          </div>
          <div className="p-4 bg-info/5 rounded-xl border border-info/10 group hover:bg-info/10 transition-all">
            <div className="text-xs font-bold text-info uppercase tracking-widest flex items-center gap-2">
               <div className="w-1.5 h-1.5 rounded-full bg-info"></div>
               Monthly Recurring
            </div>
            <p className="text-2xl font-black text-info mt-2">
              ${(stats?.revenue?.monthlyRecurring || 0).toLocaleString()}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function UserGrowthChart({ data }) {
  if (!data || data.length === 0) return null;
  const max = Math.max(...data.map(d => d.count), 1);
  const barCount = data.length;

  return (
    <div className="w-full" aria-label="User signups bar chart">
      <div className="flex items-end gap-0.5 h-24" role="img" aria-label={`Daily signups: max ${max} users/day over ${barCount} days`}>
        {data.map((d, i) => {
          const pct = Math.max((d.count / max) * 100, 2);
          return (
            <div key={d.day ?? i} className="flex-1 flex flex-col items-center justify-end group relative h-full">
              <div
                className="w-full rounded-t-sm bg-primary/70 group-hover:bg-primary transition-all duration-200"
                style={{ height: `${pct}%` }}
                aria-hidden="true"
              />
              {/* Tooltip on hover */}
              <div className="absolute bottom-full mb-1 hidden group-hover:flex flex-col items-center pointer-events-none z-10">
                <div className="bg-base-content text-base-100 text-[10px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap">
                  {d.count} new{d.day ? ` · ${d.day}` : ''}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {/* X-axis: show first, middle, and last label */}
      {data.length >= 2 && (
        <div className="flex justify-between mt-1.5">
          <span className="text-[9px] text-muted">{data[0].day}</span>
          {data.length > 4 && (
            <span className="text-[9px] text-muted">{data[Math.floor(data.length / 2)]?.day}</span>
          )}
          <span className="text-[9px] text-muted">{data[data.length - 1].day}</span>
        </div>
      )}
    </div>
  );
}

function StatCard({ title, value, icon, subtitle, trend, color = 'primary' }) {
  const getIconBg = () => {
    switch(color) {
      case 'success': return 'bg-success/10 text-success';
      case 'warning': return 'bg-warning/10 text-warning';
      case 'error': return 'bg-error/10 text-error';
      case 'info': return 'bg-info/10 text-info';
      default: return 'bg-primary/10 text-primary';
    }
  };

  return (
    <div className="bg-base-100 rounded-xl shadow-sm border border-base-300 p-6 hover:shadow-md transition-all group">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-[10px] font-black text-base-content/40 uppercase tracking-widest mb-1">{title}</p>
          <div className="flex items-baseline gap-2">
             <p className="text-2xl font-black text-base-content tracking-tight">{value}</p>
             {trend && <span className="text-[10px] font-bold text-success">+{trend}</span>}
          </div>
          {subtitle && <p className="text-xs text-base-content/50 mt-1 font-medium">{subtitle}</p>}
        </div>
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl transition-transform group-hover:scale-110 ${getIconBg()}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

export default AdminStats;

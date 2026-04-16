import { useState, useEffect } from 'react';
import api from '../../lib/api';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import { 
  Users, 
  MapPin, 
  Activity, 
  AlertTriangle, 
  ShieldAlert,
  Edit2,
  Clock,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  CheckCircle,
  XCircle,
  RefreshCw,
  Bell,
  Globe,
  Zap,
  CreditCard,
  Mail,
  Server,
  Settings,
  Gauge,
  BarChart3
} from 'lucide-react';

const StatCard = ({ title, value, change, changeType, icon: Icon, color, to }) => {
  const isPositive = changeType === 'positive';
  
  return (
    <Link 
      to={to} 
      className="p-6 bg-base-100 rounded-2xl border border-base-300 hover:border-sky-500/30 hover:shadow-lg hover:shadow-sky-500/5 transition-all group cursor-pointer"
    >
      <div className="flex items-start justify-between mb-4">
        <div className={`w-12 h-12 rounded-xl ${color.bg} flex items-center justify-center`}>
          <Icon size={24} className={color.text} />
        </div>
        {change && (
          <div className={`flex items-center gap-1 text-xs font-bold ${isPositive ? 'text-success' : 'text-error'}`}>
            {isPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
            {change}
          </div>
        )}
      </div>
      <p className="text-3xl font-black text-base-content mb-1">{value}</p>
      <p className="text-sm text-base-content/50 font-medium flex items-center gap-1 group-hover:text-sky-500 transition-colors">
        {title} <ArrowRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
      </p>
    </Link>
  );
};

const AlertCard = ({ title, count, type, icon: Icon, to }) => {
  const colorMap = {
    critical: { bg: 'bg-error/10', text: 'text-error', border: 'border-error/20' },
    warning: { bg: 'bg-warning/10', text: 'text-warning', border: 'border-warning/20' },
    info: { bg: 'bg-sky-500/10', text: 'text-sky-500', border: 'border-sky-500/20' }
  };
  const colors = colorMap[type] || colorMap.info;
  
  return (
    <Link 
      to={to}
      className={`p-4 rounded-xl border ${colors.border} ${colors.bg} hover:opacity-80 transition-opacity cursor-pointer`}
    >
      <div className="flex items-center gap-3">
        <Icon size={20} className={colors.text} />
        <div className="flex-1">
          <p className="font-bold text-base-content text-sm">{title}</p>
          <p className="text-xs text-base-content/50">{count} items</p>
        </div>
        <span className={`text-2xl font-black ${colors.text}`}>{count}</span>
      </div>
    </Link>
  );
};

const ActivityItem = ({ icon: Icon, title, description, time, color }) => (
  <div className="flex items-start gap-3 p-3 hover:bg-base-200/30 rounded-xl transition-colors">
    <div className={`w-8 h-8 rounded-lg ${color.bg} flex items-center justify-center shrink-0`}>
      <Icon size={14} className={color.text} />
    </div>
    <div className="flex-1 min-w-0">
      <p className="font-medium text-base-content text-sm truncate">{title}</p>
      <p className="text-xs text-base-content/50 truncate">{description}</p>
    </div>
    <span className="text-[10px] text-base-content/40 shrink-0">{time}</span>
  </div>
);

const ServiceStatus = ({ name, status, icon: Icon }) => {
  const statusConfig = {
    connected: { color: 'bg-success', text: 'Connected' },
    online: { color: 'bg-success', text: 'Online' },
    error: { color: 'bg-error', text: 'Error' },
    offline: { color: 'bg-error', text: 'Offline' },
    checking: { color: 'bg-warning animate-pulse', text: 'Checking' },
    not_configured: { color: 'bg-base-300', text: 'Not Configured' }
  };
  const config = statusConfig[status] || statusConfig.not_configured;
  
  return (
    <div className="flex items-center gap-3 p-3 bg-base-200/30 rounded-xl">
      <Icon size={16} className="text-base-content/50" />
      <span className="flex-1 font-medium text-sm text-base-content">{name}</span>
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${config.color}`} />
        <span className="text-xs text-base-content/60">{config.text}</span>
      </div>
    </div>
  );
};

const MiniBarChart = ({ data, metricKey }) => {
  if (!data || data.length === 0) return null;
  const values = data.map(d => d[metricKey] ?? 0);
  const max = Math.max(...values, 1);
  const colorMap = {
    users: '#0ea5e9',
    trips: '#10b981',
    newSubscriptions: '#8b5cf6',
  };
  const color = colorMap[metricKey] || '#0ea5e9';

  return (
    <div className="flex items-end gap-0.5 h-24 w-full">
      {data.map((point, i) => {
        const height = Math.max(2, Math.round((values[i] / max) * 100));
        const isLast = i === data.length - 1;
        return (
          <div
            key={point.date}
            className="flex-1 relative group"
            title={`${point.date}: ${values[i]}`}
          >
            <div
              className="w-full rounded-t-sm transition-opacity group-hover:opacity-80"
              style={{ height: `${height}%`, backgroundColor: color, opacity: isLast ? 1 : 0.55 }}
            />
            {/* Tooltip on hover */}
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
              <div className="bg-base-content text-base-100 text-[10px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap">
                {values[i]}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

const AdminDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [alerts, setAlerts] = useState({ ops: 0, errors: 0, moderation: 0 });
  const [recentActivity, setRecentActivity] = useState([]);
  const [health, setHealth] = useState(null);
  const [metricsSummary, setMetricsSummary] = useState({ total: 0, critical: 0, warning: 0, healthy: 0 });
  const [timeseries, setTimeseries] = useState([]);
  const [tsMetric, setTsMetric] = useState('users');

  useEffect(() => {
    fetchDashboardData();
  }, []);

const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      // Fetch all data in parallel (much faster than sequential)
      const results = await Promise.all([
        api.get('/admin/analytics/overview?period=30d'),
        api.get('/admin/notifications/ops-alerts', { params: { limit: 1 } }),
        api.get('/reviews/admin/list', { params: { status: 'pending', limit: 100 } }),
        api.get('/admin/audit-logs', { params: { limit: 5 } }),
        api.get('/admin/audit-logs', { params: { type: 'client_error', days: 7, limit: 1 } }),
        api.get('/admin/system-health'),
        api.get('/admin/metrics/violations'),
        api.get('/admin/analytics/timeseries?period=30d&metrics=users,trips,revenue'),
      ]);
      
      // Set data (with fallbacks for failed requests)
      const [statsRes, opsRes, modRes, auditRes, errorsRes, healthRes, metricsRes, tsRes] = results;
      setStats(statsRes?.data?.data || {});
      setAlerts({
        ops: opsRes?.data?.data?.alerts?.filter(a => !a.resolved_at).length || 0,
        errors: errorsRes?.data?.data?.total || 0,
        moderation: modRes?.data?.data?.countsByStatus?.pending || 0
      });
      setRecentActivity(auditRes?.data?.data?.logs || []);
      setHealth(healthRes?.data?.data);
      if (metricsRes?.data?.success) {
        setMetricsSummary(metricsRes.data.data.summary || { total: 0, critical: 0, warning: 0, healthy: 0 });
      }
      if (tsRes?.data?.success) {
        setTimeseries(tsRes.data.data.series || []);
      }
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-20">
        <RefreshCw className="animate-spin text-sky-500" size={40} />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Welcome Banner */}
      <div className="p-6 bg-gradient-to-r from-sky-500/10 via-emerald-500/10 to-sky-500/10 rounded-2xl border border-sky-500/20">
        <h2 className="text-2xl font-black text-base-content mb-2">Welcome to Mission Control</h2>
        <p className="text-base-content/60">Here's what's happening with SoloCompass today.</p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          title="Total Users" 
          value={stats?.totalUsers?.toLocaleString() || '0'} 
          change="+12%" 
          changeType="positive"
          icon={Users} 
          color={{ bg: 'bg-sky-500/10', text: 'text-sky-500' }}
          to="/admin/users"
        />
        <StatCard 
          title="Active Trips" 
          value={stats?.activeTrips?.toLocaleString() || '0'} 
          change="+8%" 
          changeType="positive"
          icon={MapPin} 
          color={{ bg: 'bg-emerald-500/10', text: 'text-emerald-500' }}
          to="/admin/destinations"
        />
        <StatCard 
          title="Reviews Pending" 
          value={alerts.moderation} 
          icon={Edit2} 
          color={{ bg: 'bg-amber-500/10', text: 'text-amber-500' }}
          to="/admin/moderation"
        />
        <StatCard 
          title="Ops Alerts" 
          value={alerts.ops} 
          icon={ShieldAlert} 
          color={{ bg: 'bg-red-500/10', text: 'text-red-500' }}
          to="/admin/health"
        />
      </div>

      {/* Alerts Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <AlertCard 
          title="Pending Moderation" 
          count={alerts.moderation} 
          type={alerts.moderation > 0 ? 'warning' : 'info'}
          icon={Edit2}
          to="/admin/moderation"
        />
        <AlertCard 
          title="Open Ops Alerts" 
          count={alerts.ops} 
          type={alerts.ops > 5 ? 'critical' : alerts.ops > 0 ? 'warning' : 'info'}
          icon={AlertTriangle}
          to="/admin/health"
        />
        <AlertCard 
          title="Metrics Health" 
          count={metricsSummary.total > 0 ? `${metricsSummary.critical}⚠️` : 'Healthy'} 
          type={metricsSummary.critical > 0 ? 'critical' : metricsSummary.warning > 0 ? 'warning' : 'info'}
          icon={Gauge}
          to="/admin/metrics"
        />
        <AlertCard 
          title="System Health" 
          count={health ? 'OK' : 'Unknown'} 
          type={health?.database?.status === 'connected' ? 'info' : 'critical'}
          icon={Activity}
          to="/admin/health"
        />
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Activity */}
        <div className="lg:col-span-2 bg-base-100 rounded-2xl border border-base-300 overflow-hidden">
          <div className="p-4 border-b border-base-300 bg-base-200/30 flex items-center justify-between">
            <h3 className="font-black text-base-content flex items-center gap-2">
              <Clock size={18} className="text-sky-500" />
              Recent Activity
            </h3>
            <Link to="/admin/audit" className="text-xs text-sky-500 hover:text-sky-600 font-medium">
              View All
            </Link>
          </div>
          <div className="p-2">
            {recentActivity.length > 0 ? (
              <div className="space-y-1">
                {recentActivity.slice(0, 8).map((activity, idx) => (
                  <ActivityItem
                    key={idx}
                    icon={Activity}
                    title={activity.event_name || 'System Event'}
                    description={activity.user_email || 'System'}
                    time={activity.timestamp ? new Date(activity.timestamp).toLocaleTimeString() : ''}
                    color={{ bg: 'bg-sky-500/10', text: 'text-sky-500' }}
                  />
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-base-content/40">
                <Activity size={32} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm font-medium">No recent activity</p>
              </div>
            )}
          </div>
        </div>

        {/* System Status */}
        <div className="bg-base-100 rounded-2xl border border-base-300 overflow-hidden">
          <div className="p-4 border-b border-base-300 bg-base-200/30">
            <h3 className="font-black text-base-content flex items-center gap-2">
              <Server size={18} className="text-emerald-500" />
              System Status
            </h3>
          </div>
          <div className="p-3 space-y-2">
            {health ? (
              <>
                <ServiceStatus name="Database" status={health.database?.status} icon={Server} />
                <ServiceStatus name="AI / OpenAI" status={health.ai?.status} icon={Zap} />
                <ServiceStatus name="Stripe" status={health.stripe?.status} icon={CreditCard} />
                <ServiceStatus name="Resend" status={health.resend?.status} icon={Mail} />
                <ServiceStatus name="FCDO Feed" status={health.fcdo?.status} icon={Globe} />
              </>
            ) : (
              <div className="p-4 text-center text-base-content/40">
                <p className="text-sm">System health unavailable</p>
              </div>
            )}
          </div>
          <div className="p-3 border-t border-base-300 bg-base-200/30">
            <Link 
              to="/admin/health" 
              className="flex items-center justify-center gap-2 text-sm text-sky-500 hover:text-sky-600 font-medium"
            >
              View Full Status <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </div>

      {/* Growth Trends */}
      {timeseries.length > 0 && (
        <div className="bg-base-100 rounded-2xl border border-base-300 overflow-hidden">
          <div className="p-4 border-b border-base-300 bg-base-200/30 flex items-center justify-between">
            <h3 className="font-black text-base-content flex items-center gap-2">
              <BarChart3 size={18} className="text-sky-500" />
              Growth Trends (Last 30 Days)
            </h3>
            <div className="flex items-center gap-1 text-xs">
              {[
                { key: 'users', label: 'Users', color: 'text-sky-500 bg-sky-500/10' },
                { key: 'trips', label: 'Trips', color: 'text-emerald-500 bg-emerald-500/10' },
                { key: 'newSubscriptions', label: 'Subscriptions', color: 'text-violet-500 bg-violet-500/10' },
              ].map(m => (
                <button
                  key={m.key}
                  onClick={() => setTsMetric(m.key)}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-colors ${tsMetric === m.key ? m.color : 'text-base-content/40 hover:text-base-content/60'}`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
          <div className="p-4">
            <MiniBarChart data={timeseries} metricKey={tsMetric} />
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="bg-base-100 rounded-2xl border border-base-300 p-4">
        <h3 className="font-black text-base-content mb-4">Quick Actions</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Link to="/admin/destinations" className="p-4 bg-emerald-500/10 rounded-xl hover:bg-emerald-500/20 transition-colors text-center">
            <MapPin size={24} className="mx-auto mb-2 text-emerald-500" />
            <p className="text-sm font-bold text-emerald-600">Add Destination</p>
          </Link>
          <Link to="/admin/users" className="p-4 bg-sky-500/10 rounded-xl hover:bg-sky-500/20 transition-colors text-center">
            <Users size={24} className="mx-auto mb-2 text-sky-500" />
            <p className="text-sm font-bold text-sky-600">Manage Users</p>
          </Link>
          <Link to="/admin/moderation" className="p-4 bg-amber-500/10 rounded-xl hover:bg-amber-500/20 transition-colors text-center">
            <Edit2 size={24} className="mx-auto mb-2 text-amber-500" />
            <p className="text-sm font-bold text-amber-600">Review Content</p>
          </Link>
          <Link to="/admin/config" className="p-4 bg-violet-500/10 rounded-xl hover:bg-violet-500/20 transition-colors text-center">
            <Settings size={24} className="mx-auto mb-2 text-violet-500" />
            <p className="text-sm font-bold text-violet-600">Settings</p>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
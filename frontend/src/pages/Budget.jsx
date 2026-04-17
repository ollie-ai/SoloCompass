import { useState, useEffect, useCallback } from 'react';
import { Wallet, TrendingUp, TrendingDown, PieChart, ExternalLink, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import PageHeader from '../components/PageHeader';
import EmptyState from '../components/EmptyState';
import api from '../lib/api';

const CATEGORY_ICONS = {
  accommodation: '🏨',
  transport: '✈️',
  food: '🍽️',
  activities: '🎯',
  shopping: '🛍️',
  health: '💊',
  communication: '📱',
  other: '📦',
};

function CategoryBar({ label, icon, spent, allocated, currency }) {
  const pct = allocated > 0 ? Math.min((spent / allocated) * 100, 100) : 0;
  const over = allocated > 0 && spent > allocated;
  const fmt = (n) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD', maximumFractionDigits: 0 }).format(n);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="font-bold text-base-content flex items-center gap-1.5">
          <span>{icon}</span> {label}
        </span>
        <span className={`font-black ${over ? 'text-error' : 'text-base-content'}`}>
          {fmt(spent)}
          {allocated > 0 && <span className="text-base-content/40 font-medium"> / {fmt(allocated)}</span>}
        </span>
      </div>
      {allocated > 0 && (
        <div className="w-full h-2 bg-base-200 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className={`h-full rounded-full ${over ? 'bg-error' : pct > 80 ? 'bg-warning' : 'bg-primary'}`}
          />
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, value, sub, trend, color }) {
  return (
    <div className="glass-card rounded-xl p-5">
      <p className="text-xs font-black uppercase tracking-widest text-base-content/40 mb-1">{label}</p>
      <p className={`text-2xl font-black ${color || 'text-base-content'}`}>{value}</p>
      {sub && <p className="text-xs text-base-content/50 mt-1">{sub}</p>}
      {trend !== undefined && (
        <div className={`flex items-center gap-1 mt-2 text-xs font-bold ${trend >= 0 ? 'text-error' : 'text-success'}`}>
          {trend >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
          {Math.abs(trend)}% vs last month
        </div>
      )}
    </div>
  );
}

export default function Budget() {
  const [summary, setSummary] = useState(null);
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [summaryRes, tripsRes] = await Promise.allSettled([
        api.get('/budget/summary'),
        api.get('/trips?limit=5'),
      ]);
      if (summaryRes.status === 'fulfilled') setSummary(summaryRes.value.data);
      if (tripsRes.status === 'fulfilled') {
        const t = tripsRes.value.data?.trips || tripsRes.value.data || [];
        setTrips(Array.isArray(t) ? t : []);
      }
    } catch {
      // Graceful fallback — show empty state
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleRefresh = () => { setRefreshing(true); fetchData(); };

  const currency = summary?.currency || 'USD';
  const fmt = (n) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(n ?? 0);

  const totalBudget = summary?.totalBudget ?? 0;
  const totalSpent = summary?.totalSpent ?? 0;
  const remaining = totalBudget - totalSpent;
  const overallPct = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0;
  const categories = summary?.categories || {};

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-28 lg:pb-12">
      <PageHeader
        title="Budget"
        subtitle="Track spending across all your trips"
        badge="Finance"
        icon={Wallet}
        actions={
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="btn btn-ghost btn-sm gap-2"
            aria-label="Refresh budget data"
          >
            <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
        }
      />

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-28 bg-base-content/5 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : !summary && trips.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="No budget data yet"
          description="Create a trip and set a budget to start tracking your travel finances."
          actionLabel="View Trips"
          actionHref="/trips"
        />
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <SummaryCard
              label="Total Budget"
              value={fmt(totalBudget)}
              sub={`Across ${trips.length} trip${trips.length !== 1 ? 's' : ''}`}
              color="text-base-content"
            />
            <SummaryCard
              label="Total Spent"
              value={fmt(totalSpent)}
              sub={`${overallPct}% of budget used`}
              color={overallPct > 100 ? 'text-error' : overallPct > 80 ? 'text-warning' : 'text-base-content'}
            />
            <SummaryCard
              label="Remaining"
              value={fmt(remaining)}
              sub={remaining < 0 ? 'Over budget' : 'Available to spend'}
              color={remaining < 0 ? 'text-error' : 'text-success'}
            />
          </div>

          {/* Overall progress */}
          {totalBudget > 0 && (
            <div className="glass-card rounded-xl p-6 mb-8">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-black text-base-content text-lg">Overall Progress</h2>
                <span className={`text-sm font-black ${overallPct > 100 ? 'text-error' : overallPct > 80 ? 'text-warning' : 'text-success'}`}>
                  {overallPct}%
                </span>
              </div>
              <div className="w-full h-3 bg-base-200 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(overallPct, 100)}%` }}
                  transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
                  className={`h-full rounded-full ${overallPct > 100 ? 'bg-error' : overallPct > 80 ? 'bg-warning' : 'bg-primary'}`}
                />
              </div>
            </div>
          )}

          {/* Category breakdown */}
          {Object.keys(categories).length > 0 && (
            <div className="glass-card rounded-xl p-6 mb-8">
              <h2 className="font-black text-base-content text-lg mb-6 flex items-center gap-2">
                <PieChart size={18} className="text-primary" />
                Category Breakdown
              </h2>
              <div className="space-y-5">
                {Object.entries(categories).map(([key, cat]) => (
                  <CategoryBar
                    key={key}
                    label={cat.label || key}
                    icon={CATEGORY_ICONS[key] || '📦'}
                    spent={cat.spent || 0}
                    allocated={cat.allocated || 0}
                    currency={currency}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Trip budgets */}
          {trips.length > 0 && (
            <div className="glass-card rounded-xl p-6">
              <h2 className="font-black text-base-content text-lg mb-4">Trip Budgets</h2>
              <div className="divide-y divide-base-200">
                {trips.map(trip => (
                  <div key={trip.id} className="py-3 flex items-center justify-between">
                    <div>
                      <p className="font-bold text-base-content">{trip.name || trip.title || 'Unnamed Trip'}</p>
                      {trip.destination && (
                        <p className="text-xs text-base-content/50">{trip.destination}</p>
                      )}
                    </div>
                    <Link
                      to={`/trips/${trip.id}?tab=budget`}
                      className="btn btn-ghost btn-xs gap-1 text-primary font-bold"
                    >
                      View Budget
                      <ExternalLink size={12} />
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

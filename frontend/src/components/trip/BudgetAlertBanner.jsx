import { AlertTriangle, TrendingUp, CheckCircle2 } from 'lucide-react';

/**
 * Displays an alert banner when budget thresholds are crossed.
 * threshold: percentage (0-100) of budget used.
 */
export default function BudgetAlertBanner({ totalBudget, totalSpent, currency }) {
  if (!totalBudget || totalBudget <= 0) return null;

  const pct = Math.round((totalSpent / totalBudget) * 100);

  if (pct < 75) return null;

  let level, message, icon, styles;

  if (pct >= 100) {
    level = 'over';
    message = `You've exceeded your budget by ${currency} ${(totalSpent - totalBudget).toFixed(2)}`;
    icon = <AlertTriangle size={16} className="shrink-0" />;
    styles = 'bg-red-100 text-red-700 border-red-200';
  } else if (pct >= 90) {
    level = 'critical';
    message = `${pct}% of your budget used — nearly at the limit`;
    icon = <TrendingUp size={16} className="shrink-0" />;
    styles = 'bg-orange-100 text-orange-700 border-orange-200';
  } else {
    level = 'warning';
    message = `${pct}% of your budget used — spend carefully`;
    icon = <TrendingUp size={16} className="shrink-0" />;
    styles = 'bg-amber-100 text-amber-700 border-amber-200';
  }

  return (
    <div className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-bold ${styles}`}>
      {icon}
      <span>{message}</span>
    </div>
  );
}

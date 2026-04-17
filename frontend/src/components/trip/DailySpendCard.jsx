import { TrendingUp, TrendingDown, Minus, Calendar } from 'lucide-react';

/**
 * Shows daily spending average vs. daily target.
 */
export default function DailySpendCard({ dailyAverage, dailyTarget, currency, daysElapsed, tripDays }) {
  if (dailyAverage === null && dailyTarget === null) return null;

  const pace = dailyTarget
    ? dailyAverage > dailyTarget * 1.1 ? 'over' : dailyAverage < dailyTarget * 0.9 ? 'under' : 'on-track'
    : null;

  const paceStyles = {
    over: { icon: <TrendingUp size={16} />, color: 'text-red-500', label: 'Over pace' },
    under: { icon: <TrendingDown size={16} />, color: 'text-emerald-500', label: 'Under budget' },
    'on-track': { icon: <Minus size={16} />, color: 'text-amber-500', label: 'On track' },
  };

  const paceInfo = pace ? paceStyles[pace] : null;

  return (
    <div className="bg-base-200 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-black text-base-content/70 flex items-center gap-1.5">
          <Calendar size={14} />
          Daily Spending
        </h4>
        {paceInfo && (
          <span className={`flex items-center gap-1 text-xs font-bold ${paceInfo.color}`}>
            {paceInfo.icon}{paceInfo.label}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {dailyAverage !== null && (
          <div>
            <p className="text-xs text-base-content/40 font-bold">Daily Average</p>
            <p className="text-xl font-black text-base-content">
              {currency} {Number(dailyAverage).toFixed(2)}
            </p>
            {daysElapsed && (
              <p className="text-xs text-base-content/40">over {daysElapsed} day{daysElapsed > 1 ? 's' : ''}</p>
            )}
          </div>
        )}
        {dailyTarget !== null && dailyTarget !== undefined && (
          <div>
            <p className="text-xs text-base-content/40 font-bold">Daily Target</p>
            <p className="text-xl font-black text-base-content">
              {currency} {Number(dailyTarget).toFixed(2)}
            </p>
            {tripDays && (
              <p className="text-xs text-base-content/40">{tripDays} day trip</p>
            )}
          </div>
        )}
      </div>

      {pace === 'over' && dailyTarget && dailyAverage && (
        <div className="mt-2 pt-2 border-t border-base-content/10">
          <p className="text-xs text-red-500 font-bold">
            +{currency} {(dailyAverage - dailyTarget).toFixed(2)}/day over target
          </p>
        </div>
      )}
    </div>
  );
}

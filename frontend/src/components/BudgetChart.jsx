import { useMemo, useState } from 'react';

const COLORS = ['#10b981', '#06b6d4', '#6366f1', '#f59e0b', '#ec4899', '#ef4444', '#8b5cf6', '#14b8a6'];

export default function BudgetChart({ data = [], currency = 'GBP', formatCurrency }) {
  const [mode, setMode] = useState('pie');

  const safeData = useMemo(() => {
    const total = data.reduce((sum, d) => sum + (d.amount || 0), 0);
    return data
      .filter((d) => (d.amount || 0) > 0)
      .map((d, i) => ({
        ...d,
        color: COLORS[i % COLORS.length],
        percent: total > 0 ? ((d.amount || 0) / total) * 100 : 0,
      }));
  }, [data]);

  const total = safeData.reduce((sum, d) => sum + d.amount, 0);

  const pieArcs = useMemo(() => {
    let cumulative = 0;
    return safeData.map((item) => {
      const start = cumulative;
      cumulative += item.percent;
      return { ...item, start, end: cumulative };
    });
  }, [safeData]);

  const polarToCartesian = (cx, cy, r, angleDeg) => {
    const rad = ((angleDeg - 90) * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  };

  const arcPath = (startPct, endPct) => {
    const startAngle = (startPct / 100) * 360;
    const endAngle = (endPct / 100) * 360;
    const start = polarToCartesian(60, 60, 50, endAngle);
    const end = polarToCartesian(60, 60, 50, startAngle);
    const largeArc = endAngle - startAngle > 180 ? 1 : 0;
    return `M 60 60 L ${end.x} ${end.y} A 50 50 0 ${largeArc} 1 ${start.x} ${start.y} Z`;
  };

  if (safeData.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-black text-base-content/70 uppercase tracking-wider">Budget Chart</h4>
        <div className="flex items-center gap-1 bg-base-200 rounded-lg p-1">
          <button
            type="button"
            onClick={() => setMode('pie')}
            className={`px-2.5 py-1 text-xs rounded-md font-bold ${mode === 'pie' ? 'bg-base-100 text-base-content' : 'text-base-content/60'}`}
          >
            Pie
          </button>
          <button
            type="button"
            onClick={() => setMode('bar')}
            className={`px-2.5 py-1 text-xs rounded-md font-bold ${mode === 'bar' ? 'bg-base-100 text-base-content' : 'text-base-content/60'}`}
          >
            Bar
          </button>
        </div>
      </div>

      {mode === 'pie' ? (
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <svg
            viewBox="0 0 120 120"
            className="w-40 h-40"
            role="img"
            aria-label="Pie chart showing spending by category"
          >
            <title>Budget spending by category</title>
            <desc>Distribution of total spending across budget categories.</desc>
            {pieArcs.map((slice) => (
              <path key={slice.key} d={arcPath(slice.start, slice.end)} fill={slice.color} />
            ))}
            <circle cx="60" cy="60" r="24" fill="currentColor" className="text-base-100" />
            <text x="60" y="56" textAnchor="middle" className="fill-base-content/50 text-[6px] font-bold uppercase">Spent</text>
            <text x="60" y="65" textAnchor="middle" className="fill-base-content text-[7px] font-black">
              {formatCurrency ? formatCurrency(total, currency) : total}
            </text>
          </svg>
          <div className="grid grid-cols-1 gap-1.5 w-full">
            {safeData.map((item) => (
              <div key={item.key} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="font-bold text-base-content/70 truncate">{item.label}</span>
                </div>
                <span className="font-bold text-base-content/60">{item.percent.toFixed(0)}%</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {safeData.map((item) => (
            <div key={item.key}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-bold text-base-content/70">{item.label}</span>
                <span className="font-bold text-base-content/60">
                  {formatCurrency ? formatCurrency(item.amount, currency) : item.amount}
                </span>
              </div>
              <div className="h-2 rounded-full bg-base-300 overflow-hidden">
                <div
                  className="h-full rounded-full"
                  role="progressbar"
                  aria-label={`${item.label} spending`}
                  aria-valuemin={0}
                  aria-valuenow={Math.round(item.percent)}
                  aria-valuemax={100}
                  title={`${item.label}: ${item.percent.toFixed(1)}%`}
                  style={{ width: `${Math.max(item.percent, 2)}%`, backgroundColor: item.color }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

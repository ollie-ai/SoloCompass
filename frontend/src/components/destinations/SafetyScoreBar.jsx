function SafetyScoreBar({ label, score, max = 10, className = '' }) {
  const pct = Math.min(100, Math.max(0, (score / max) * 100));
  const color = score >= 7 ? 'bg-green-500' : score >= 5 ? 'bg-yellow-500' : 'bg-red-500';

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <span className="w-24 text-sm text-gray-600 dark:text-gray-400 text-right shrink-0">{label}</span>
      <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-8 text-sm font-medium text-gray-700 dark:text-gray-300">{score?.toFixed(1) ?? '—'}</span>
    </div>
  );
}

export default SafetyScoreBar;

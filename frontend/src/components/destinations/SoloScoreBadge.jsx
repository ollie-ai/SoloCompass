function SoloScoreBadge({ score, size = 'md', className = '' }) {
  if (!score && score !== 0) return null;

  const numScore = typeof score === 'number' ? score : parseFloat(score);
  
  const getColor = (s) => {
    if (s >= 8) return 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300';
    if (s >= 6) return 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300';
    return 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300';
  };

  const getLabel = (s) => {
    if (s >= 8) return 'Solo-Friendly';
    if (s >= 6) return 'Moderate';
    return 'Challenging';
  };

  const sizes = {
    sm: 'text-xs px-1.5 py-0.5',
    md: 'text-sm px-2 py-1',
    lg: 'text-base px-3 py-1.5'
  };

  const displayScore = numScore > 10 ? (numScore / 10).toFixed(1) : numScore.toFixed(1);

  return (
    <span className={`inline-flex items-center gap-1 rounded-full border font-medium ${getColor(numScore > 10 ? numScore / 10 : numScore)} ${sizes[size] || sizes.md} ${className}`}>
      <span>👤</span>
      <span>{displayScore}/10</span>
      <span className="opacity-75">{getLabel(numScore > 10 ? numScore / 10 : numScore)}</span>
    </span>
  );
}

export default SoloScoreBadge;

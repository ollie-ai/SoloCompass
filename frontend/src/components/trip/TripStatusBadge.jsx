export default function TripStatusBadge({ status, size = 'sm' }) {
  const styles = {
    draft:      'bg-base-200 text-base-content/50',
    planning:   'bg-blue-100 text-blue-700',
    confirmed:  'bg-emerald-100 text-emerald-700',
    live:       'bg-purple-100 text-purple-700 animate-pulse',
    completed:  'bg-base-300 text-base-content/60',
    cancelled:  'bg-red-100 text-red-600',
    archived:   'bg-base-300 text-base-content/40',
  };

  const labels = {
    draft:      'Draft',
    planning:   'Planning',
    confirmed:  'Confirmed',
    live:       '🔴 Live',
    completed:  'Completed',
    cancelled:  'Cancelled',
    archived:   'Archived',
  };

  const className = `inline-flex items-center px-2 py-0.5 rounded-full font-bold text-${size === 'sm' ? 'xs' : 'sm'} ${styles[status] || 'bg-base-200 text-base-content/50'}`;

  return (
    <span className={className}>
      {labels[status] || status}
    </span>
  );
}

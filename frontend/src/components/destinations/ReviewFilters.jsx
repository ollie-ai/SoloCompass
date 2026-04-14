import StarRating from '../StarRating';

function ReviewFilters({ filters, onChange, className = '' }) {
  const update = (key, value) => onChange({ ...filters, [key]: value });

  return (
    <div className={`flex flex-wrap items-center gap-3 ${className}`}>
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-500">Min rating:</span>
        <StarRating
          value={filters.min_rating || 0}
          onChange={v => update('min_rating', v === filters.min_rating ? 0 : v)}
          size="sm"
        />
      </div>
      <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 cursor-pointer">
        <input
          type="checkbox"
          checked={filters.solo_only || false}
          onChange={e => update('solo_only', e.target.checked)}
          className="rounded"
        />
        Solo travellers only
      </label>
      {filters.min_rating > 0 && (
        <button
          onClick={() => onChange({ ...filters, min_rating: 0, solo_only: false })}
          className="text-xs text-gray-400 hover:text-gray-600 underline"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}

export default ReviewFilters;

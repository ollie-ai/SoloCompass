import { useState } from 'react';
import ReviewCard from '../ReviewCard';
import StarRating from '../StarRating';
import { ChevronDown } from 'lucide-react';

function ReviewList({ reviews = [], onLoadMore, hasMore = false, loading = false, className = '' }) {
  const [sort, setSort] = useState('newest');

  const sorted = [...reviews].sort((a, b) => {
    if (sort === 'helpful') return (b.helpful_count || 0) - (a.helpful_count || 0);
    if (sort === 'highest') return (b.overall_rating || 0) - (a.overall_rating || 0);
    return new Date(b.created_at) - new Date(a.created_at);
  });

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{reviews.length} review{reviews.length !== 1 ? 's' : ''}</p>
        <select
          value={sort}
          onChange={e => setSort(e.target.value)}
          className="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300"
        >
          <option value="newest">Newest</option>
          <option value="helpful">Most Helpful</option>
          <option value="highest">Highest Rated</option>
        </select>
      </div>

      {sorted.length === 0 ? (
        <p className="text-center text-gray-500 py-8">No reviews yet</p>
      ) : (
        sorted.map(review => <ReviewCard key={review.id} review={review} />)
      )}

      {hasMore && (
        <button
          onClick={onLoadMore}
          disabled={loading}
          className="w-full py-2 text-sm text-indigo-600 hover:text-indigo-700 flex items-center justify-center gap-1 disabled:opacity-50"
        >
          <ChevronDown className="w-4 h-4" />
          {loading ? 'Loading...' : 'Load more'}
        </button>
      )}
    </div>
  );
}

export default ReviewList;

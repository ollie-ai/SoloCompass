import { useState, useEffect } from 'react';
import { ThumbsUp, Tag } from 'lucide-react';
import destinationService from '../../lib/destinationService';

const CATEGORIES = ['general', 'safety', 'transport', 'food', 'accommodation', 'nightlife', 'solo-specific'];

function CommunityTipsList({ destinationId }) {
  const [tips, setTips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('');

  useEffect(() => {
    if (!destinationId) return;
    setLoading(true);
    const params = activeCategory ? { category: activeCategory } : {};
    destinationService.getTips(destinationId, params)
      .then(res => setTips(res.data?.data || []))
      .catch(() => setTips([]))
      .finally(() => setLoading(false));
  }, [destinationId, activeCategory]);

  if (loading) return <div className="animate-pulse space-y-3">{[1,2,3].map(i => <div key={i} className="h-16 bg-gray-100 dark:bg-gray-800 rounded-xl" />)}</div>;

  return (
    <div className="space-y-4">
      {/* Category filters */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setActiveCategory('')}
          className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${!activeCategory ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-300 text-gray-600 hover:border-indigo-400 dark:border-gray-600 dark:text-gray-400'}`}
        >
          All
        </button>
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat === activeCategory ? '' : cat)}
            className={`px-3 py-1 rounded-full text-xs font-medium border capitalize transition-colors ${activeCategory === cat ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-300 text-gray-600 hover:border-indigo-400 dark:border-gray-600 dark:text-gray-400'}`}
          >
            {cat}
          </button>
        ))}
      </div>

      {tips.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <Tag className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No tips yet. Be the first to share!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tips.map(tip => (
            <div key={tip.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    {tip.category && tip.category !== 'general' && (
                      <span className="text-xs bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-full capitalize">
                        {tip.category}
                      </span>
                    )}
                    <span className="text-xs text-gray-500">{tip.author_name || 'Traveller'}</span>
                  </div>
                  <p className="text-sm text-gray-700 dark:text-gray-300">{tip.content}</p>
                </div>
                <div className="flex items-center gap-1 text-xs text-gray-500 shrink-0">
                  <ThumbsUp className="w-3 h-3" />
                  <span>{tip.upvotes || 0}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default CommunityTipsList;

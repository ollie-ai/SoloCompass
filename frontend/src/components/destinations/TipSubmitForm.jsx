import { useState } from 'react';
import { Send } from 'lucide-react';
import destinationService from '../../lib/destinationService';

const CATEGORIES = ['general', 'safety', 'transport', 'food', 'accommodation', 'nightlife', 'solo-specific'];

function TipSubmitForm({ destinationId, onSuccess }) {
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('general');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (content.trim().length < 20) {
      setError('Tip must be at least 20 characters');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await destinationService.submitTip(destinationId, { content: content.trim(), category });
      setContent('');
      setCategory('general');
      onSuccess && onSuccess();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to submit tip. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3">
      <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Share a tip</h4>
      <select
        value={category}
        onChange={e => setCategory(e.target.value)}
        className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300"
      >
        {CATEGORIES.map(cat => (
          <option key={cat} value={cat} className="capitalize">{cat.charAt(0).toUpperCase() + cat.slice(1)}</option>
        ))}
      </select>
      <textarea
        value={content}
        onChange={e => setContent(e.target.value)}
        placeholder="Share your insider knowledge about this destination..."
        rows={3}
        className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />
      {error && <p className="text-xs text-red-500">{error}</p>}
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-400">{content.length}/500</span>
        <button
          type="submit"
          disabled={loading || content.trim().length < 20}
          className="flex items-center gap-2 px-4 py-1.5 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Send className="w-3 h-3" />
          {loading ? 'Submitting...' : 'Submit'}
        </button>
      </div>
    </form>
  );
}

export default TipSubmitForm;

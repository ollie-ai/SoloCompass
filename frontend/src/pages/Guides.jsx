import { useState, useEffect } from 'react';
import { BookOpen, Search } from 'lucide-react';
import GuideCard from '../components/GuideCard';
import EmptyState from '../components/EmptyState';
import api from '../lib/api';

const CATEGORIES = ['all', 'safety', 'budget', 'planning', 'culture', 'packing', 'transport', 'accommodation'];

export default function Guides() {
  const [guides, setGuides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    const fetchGuides = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (category !== 'all') params.set('category', category);
        const res = await api.get(`/v1/content/guides?${params}`);
        setGuides(res.data?.data || []);
      } catch {
        setGuides([]);
      } finally {
        setLoading(false);
      }
    };
    fetchGuides();
  }, [category]);

  const filtered = search
    ? guides.filter(g =>
        g.title.toLowerCase().includes(search.toLowerCase()) ||
        g.excerpt?.toLowerCase().includes(search.toLowerCase())
      )
    : guides;

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-base-content flex items-center gap-3">
          <BookOpen className="text-primary" size={32} />
          Solo Travel Guides
        </h1>
        <p className="text-base-content/60 mt-2">Expert guides crafted for the solo traveller</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 mb-8">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40" />
          <input
            type="text"
            placeholder="Search guides..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input input-bordered w-full pl-9"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`btn btn-sm capitalize ${category === cat ? 'btn-primary' : 'btn-ghost'}`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="card bg-base-100 shadow-sm animate-pulse">
              <div className="h-48 bg-base-200 rounded-t-xl" />
              <div className="card-body gap-2">
                <div className="h-4 bg-base-200 rounded w-1/4" />
                <div className="h-5 bg-base-200 rounded w-3/4" />
                <div className="h-4 bg-base-200 rounded w-full" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No guides yet"
          description="Travel guides will appear here as they're published."
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map(guide => <GuideCard key={guide.id} guide={guide} />)}
        </div>
      )}
    </div>
  );
}

import { useState, useEffect } from 'react';
import { Lightbulb, Search } from 'lucide-react';
import EmptyState from '../components/EmptyState';
import api from '../lib/api';

const CATEGORIES = ['all', 'safety', 'budget', 'planning', 'culture', 'packing', 'transport', 'health', 'tech'];
const DIFFICULTIES = ['all', 'beginner', 'intermediate', 'advanced'];

const DIFFICULTY_BADGE = {
  beginner: 'badge-success',
  intermediate: 'badge-warning',
  advanced: 'badge-error',
};

export default function Tips() {
  const [tips, setTips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('all');
  const [difficulty, setDifficulty] = useState('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    const fetchTips = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (category !== 'all') params.set('category', category);
        if (difficulty !== 'all') params.set('difficulty', difficulty);
        const res = await api.get(`/v1/content/tips?${params}`);
        setTips(res.data?.data || []);
      } catch {
        setTips([]);
      } finally {
        setLoading(false);
      }
    };
    fetchTips();
  }, [category, difficulty]);

  const filtered = search
    ? tips.filter(t =>
        t.title.toLowerCase().includes(search.toLowerCase()) ||
        t.content?.toLowerCase().includes(search.toLowerCase())
      )
    : tips;

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-base-content flex items-center gap-3">
          <Lightbulb className="text-primary" size={32} />
          Solo Travel Tips
        </h1>
        <p className="text-base-content/60 mt-2">Practical advice from experienced solo travellers</p>
      </div>

      <div className="flex flex-col gap-4 mb-8">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40" />
          <input
            type="text"
            placeholder="Search tips..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input input-bordered w-full pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="text-sm font-medium text-base-content/60 self-center mr-1">Category:</span>
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
        <div className="flex flex-wrap gap-2">
          <span className="text-sm font-medium text-base-content/60 self-center mr-1">Level:</span>
          {DIFFICULTIES.map(d => (
            <button
              key={d}
              onClick={() => setDifficulty(d)}
              className={`btn btn-sm capitalize ${difficulty === d ? 'btn-primary' : 'btn-ghost'}`}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col gap-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="card bg-base-100 shadow-sm animate-pulse p-5">
              <div className="h-5 bg-base-200 rounded w-2/3 mb-3" />
              <div className="h-4 bg-base-200 rounded w-full mb-2" />
              <div className="h-4 bg-base-200 rounded w-3/4" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Lightbulb}
          title="No tips yet"
          description="Solo travel tips will appear here as they're added."
        />
      ) : (
        <div className="flex flex-col gap-4">
          {filtered.map(tip => (
            <div key={tip.id} className="card bg-base-100 shadow-sm border border-base-200 hover:shadow-md transition-shadow">
              <div className="card-body p-5">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-semibold text-base-content text-lg leading-snug">{tip.title}</h3>
                  <div className="flex gap-2 flex-shrink-0">
                    {tip.difficulty && (
                      <span className={`badge badge-sm capitalize ${DIFFICULTY_BADGE[tip.difficulty] || 'badge-ghost'}`}>
                        {tip.difficulty}
                      </span>
                    )}
                    {tip.category && tip.category !== 'general' && (
                      <span className="badge badge-sm badge-ghost capitalize">{tip.category}</span>
                    )}
                  </div>
                </div>
                <p className="text-sm text-base-content/70 mt-1 leading-relaxed">{tip.content}</p>
                {tip.helpful_count > 0 && (
                  <p className="text-xs text-base-content/40 mt-2">{tip.helpful_count} travellers found this helpful</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

import { useState, useEffect, useCallback } from 'react';
import { BookOpen, Plus, MapPin, Calendar, ArrowRight } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../lib/api';

function EntryRow({ entry }) {
  const date = entry.travel_date || entry.created_at;
  const formattedDate = date
    ? new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '';

  return (
    <Link
      to="/journal"
      className="flex items-start gap-3 py-2.5 hover:bg-base-200/60 rounded-lg px-2 -mx-2 transition-colors group"
    >
      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
        <BookOpen size={14} className="text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-base-content truncate group-hover:text-primary transition-colors">
          {entry.title || 'Untitled Entry'}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          {entry.destination && (
            <span className="flex items-center gap-0.5 text-xs text-base-content/50">
              <MapPin size={9} />
              {entry.destination}
            </span>
          )}
          {formattedDate && (
            <span className="flex items-center gap-0.5 text-xs text-base-content/40">
              <Calendar size={9} />
              {formattedDate}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

export default function RecentJournalWidget({ className = '' }) {
  const navigate = useNavigate();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchEntries = useCallback(async () => {
    try {
      const res = await api.get('/journal/entries', { params: { limit: 3 } });
      const data = res.data?.entries || res.data || [];
      setEntries(Array.isArray(data) ? data.slice(0, 3) : []);
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  return (
    <div className={`dashboard-widget ${className}`}>
      <div className="dashboard-widget-header">
        <div className="dashboard-widget-title">
          <BookOpen size={18} className="text-brand-vibrant" />
          <h3>Journal</h3>
        </div>
        <Link
          to="/journal"
          className="flex items-center gap-1 text-xs font-bold text-brand-vibrant hover:text-brand-vibrant/80 transition-colors"
        >
          View all <ArrowRight size={11} />
        </Link>
      </div>

      {loading ? (
        <div className="space-y-3 py-1">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex gap-3">
              <div className="w-8 h-8 rounded-lg bg-base-content/5 animate-pulse shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 bg-base-content/5 rounded animate-pulse w-3/4" />
                <div className="h-2.5 bg-base-content/5 rounded animate-pulse w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : entries.length === 0 ? (
        <div className="dashboard-empty-state py-4">
          <div className="dashboard-empty-icon">
            <BookOpen size={20} />
          </div>
          <p className="dashboard-empty-title">No journal entries yet</p>
          <p className="dashboard-empty-text">Start capturing your travel memories</p>
          <button
            onClick={() => navigate('/journal')}
            className="btn-brand text-sm px-4 py-2"
          >
            Write First Entry
          </button>
        </div>
      ) : (
        <>
          <div className="space-y-0 mt-1">
            {entries.map((entry, i) => (
              <EntryRow key={entry.id || i} entry={entry} />
            ))}
          </div>
          <div className="mt-3 pt-3 border-t border-base-300/50">
            <button
              onClick={() => navigate('/journal')}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold transition-colors"
            >
              <Plus size={13} />
              New Entry
            </button>
          </div>
        </>
      )}
    </div>
  );
}

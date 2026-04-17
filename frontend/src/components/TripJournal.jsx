import { useState, useEffect } from 'react';
import { BookOpen, Plus, Loader2, X, Share2, MapPin, Cloud, Copy, Check } from 'lucide-react';
import { getJournalEntries, createJournalEntry, getJournalTemplates, shareJournalEntry } from '../lib/api';
import toast from 'react-hot-toast';
import { getErrorMessage } from '../lib/utils';

const TEMPLATE_ICONS = {
  daily_log: '📝',
  highlight: '⭐',
  food_review: '🍽️',
  freeform: '✏️'
};

const TripJournal = ({ tripId, tripName, onClose }) => {
  const [entries, setEntries] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState('daily_log');
  const [shareLink, setShareLink] = useState(null);
  const [newEntry, setNewEntry] = useState({
    title: '',
    content: '',
    templateType: 'daily_log',
    locationName: ''
  });

  useEffect(() => {
    fetchEntries();
    fetchTemplates();
  }, [tripId]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const fetchEntries = async () => {
    try {
      setLoading(true);
      const response = await getJournalEntries(tripId);
      setEntries(response.data || []);
    } catch (error) {
      console.error('Error fetching journal entries:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTemplates = async () => {
    try {
      const response = await getJournalTemplates();
      setTemplates(response.data || []);
    } catch (error) {
      console.error('Error fetching journal templates:', error);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newEntry.title.trim()) {
      toast.error('Please enter a title');
      return;
    }
    try {
      setCreating(true);
      const response = await createJournalEntry(tripId, {
        title: newEntry.title,
        content: newEntry.content,
        templateType: newEntry.templateType,
        locationName: newEntry.locationName || null
      });
      setEntries(prev => [response.data, ...prev]);
      setNewEntry({ title: '', content: '', templateType: 'daily_log', locationName: '' });
      setShowCreate(false);
      toast.success('Journal entry created!');
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to create entry'));
    } finally {
      setCreating(false);
    }
  };

  const handleShare = async (entryId) => {
    try {
      const response = await shareJournalEntry(entryId);
      const url = `${window.location.origin}${response.data.url}`;
      setShareLink(url);
      await navigator.clipboard.writeText(url);
      toast.success('Share link copied to clipboard!');
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to create share link'));
    }
  };

  const currentTemplate = templates.find(t => t.id === selectedTemplate);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="animate-spin text-brand-vibrant" size={32} />
      </div>
    );
  }

  return (
    <div className="bg-base-100 rounded-2xl p-8 max-w-lg mx-auto shadow-xl border border-base-300/50 max-h-[80vh] overflow-hidden flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-black text-base-content">Travel Journal</h2>
          <p className="text-sm text-base-content/60">{tripName}</p>
        </div>
        <button
          onClick={onClose}
          className="p-2 text-base-content/40 hover:text-base-content/80 hover:bg-base-200 rounded-xl transition-colors"
        >
          <X size={20} />
        </button>
      </div>

      {/* Entries count */}
      {entries.length > 0 && (
        <div className="mb-4 p-4 bg-gradient-to-r from-purple-500/5 to-pink-500/5 rounded-xl border border-purple-500/10">
          <div className="flex justify-between text-sm">
            <span className="text-base-content/80 font-bold">
              {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
            </span>
            <span className="font-black text-purple-500">
              {TEMPLATE_ICONS[entries[0]?.template_type] || '📝'}
            </span>
          </div>
        </div>
      )}

      {/* Entries list */}
      <div className="flex-1 overflow-y-auto mb-4 pr-2 space-y-3">
        {entries.length === 0 && !showCreate ? (
          <div className="text-center py-12">
            <div className="w-20 h-20 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
              <BookOpen className="text-purple-500" size={36} />
            </div>
            <h3 className="text-lg font-black text-base-content mb-2">Start Your Journal</h3>
            <p className="text-base-content/60 font-medium text-sm mb-6">
              Capture memories, reflections, and food discoveries from your trip.
            </p>
            <button
              onClick={() => setShowCreate(true)}
              className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-bold hover:shadow-xl hover:shadow-purple-500/20 transition-all flex items-center gap-2 mx-auto"
            >
              <Plus size={18} />
              Write First Entry
            </button>
          </div>
        ) : (
          entries.map((entry) => (
            <div
              key={entry.id}
              className="p-4 bg-base-200 rounded-xl border border-base-200 hover:border-purple-500/30 transition-colors"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{TEMPLATE_ICONS[entry.template_type] || '📝'}</span>
                  <h4 className="font-bold text-base-content">{entry.title}</h4>
                </div>
                <button
                  onClick={() => handleShare(entry.id)}
                  className="p-1.5 text-base-content/40 hover:text-purple-500 hover:bg-purple-500/10 rounded-lg transition-colors"
                  title="Share this entry"
                >
                  <Share2 size={14} />
                </button>
              </div>
              {entry.content && (
                <p className="text-sm text-base-content/60 leading-relaxed line-clamp-3 mb-2">
                  {entry.content}
                </p>
              )}
              <div className="flex items-center gap-3 text-xs text-base-content/40">
                {entry.location_name && (
                  <span className="flex items-center gap-1">
                    <MapPin size={10} /> {entry.location_name}
                  </span>
                )}
                {entry.weather_summary && (
                  <span className="flex items-center gap-1">
                    <Cloud size={10} /> {entry.weather_summary}
                  </span>
                )}
                <span>
                  {new Date(entry.created_at).toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create entry form */}
      {showCreate ? (
        <form onSubmit={handleCreate} className="p-4 bg-base-200 rounded-xl space-y-3 border border-base-300">
          <div className="flex gap-2 mb-2">
            {Object.entries(TEMPLATE_ICONS).map(([key, icon]) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setSelectedTemplate(key);
                  setNewEntry(prev => ({ ...prev, templateType: key }));
                }}
                className={`flex-1 py-2 rounded-lg font-bold text-sm transition-all ${
                  newEntry.templateType === key
                    ? 'bg-purple-500/20 text-purple-600 border-2 border-purple-500/30'
                    : 'bg-base-300 text-base-content/60 border-2 border-transparent hover:bg-base-300'
                }`}
              >
                {icon}
              </button>
            ))}
          </div>

          {currentTemplate?.prompts && (
            <div className="text-xs text-base-content/40 space-y-1 p-2 bg-base-100 rounded-lg">
              {currentTemplate.prompts.map((prompt, i) => (
                <p key={i}>💡 {prompt}</p>
              ))}
            </div>
          )}

          <input
            type="text"
            value={newEntry.title}
            onChange={e => setNewEntry(prev => ({ ...prev, title: e.target.value }))}
            placeholder="Entry title"
            className="w-full px-3 py-2.5 border-2 border-base-300 bg-base-100 rounded-lg text-sm font-bold focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none text-base-content"
            autoFocus
            required
          />

          <textarea
            value={newEntry.content}
            onChange={e => setNewEntry(prev => ({ ...prev, content: e.target.value }))}
            placeholder="Write your thoughts..."
            rows="4"
            className="w-full px-3 py-2.5 border-2 border-base-300 bg-base-100 rounded-lg text-sm font-medium focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none text-base-content resize-none"
          />

          <input
            type="text"
            value={newEntry.locationName}
            onChange={e => setNewEntry(prev => ({ ...prev, locationName: e.target.value }))}
            placeholder="📍 Location (optional)"
            className="w-full px-3 py-2.5 border-2 border-base-300 bg-base-100 rounded-lg text-sm font-medium focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none text-base-content"
          />

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="flex-1 px-4 py-2.5 border-2 border-base-300 rounded-lg text-sm font-bold text-base-content/60 hover:bg-base-300 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={creating}
              className="flex-1 px-4 py-2.5 bg-purple-500 text-white rounded-lg text-sm font-bold hover:bg-purple-600 transition-colors shadow-lg shadow-purple-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {creating ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />}
              Save Entry
            </button>
          </div>
        </form>
      ) : entries.length > 0 ? (
        <button
          onClick={() => setShowCreate(true)}
          className="w-full py-3.5 border-2 border-dashed border-purple-500/20 rounded-xl text-purple-500/60 hover:border-purple-500 hover:text-purple-500 hover:bg-purple-500/5 transition-all flex items-center justify-center gap-2 font-bold"
        >
          <Plus size={18} />
          New Entry
        </button>
      ) : null}
    </div>
  );
};

export default TripJournal;

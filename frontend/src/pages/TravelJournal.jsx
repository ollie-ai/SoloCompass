import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  BookOpen, Plus, Edit2, Trash2, MapPin, Calendar, Loader2, X, ChevronLeft,
  Camera, Smile, Cloud, Lock, Unlock, Image
} from 'lucide-react';
import { getJournalEntries, createJournalEntry, updateJournalEntry, deleteJournalEntry } from '../lib/api';
import { getErrorMessage } from '../lib/utils';

const MOOD_OPTIONS = [
  { value: 'amazing', label: 'Amazing', emoji: '🤩' },
  { value: 'good', label: 'Good', emoji: '😊' },
  { value: 'okay', label: 'Okay', emoji: '😐' },
  { value: 'difficult', label: 'Difficult', emoji: '😟' },
  { value: 'terrible', label: 'Terrible', emoji: '😢' },
];

function getMoodEmoji(mood) {
  return MOOD_OPTIONS.find(m => m.value === mood)?.emoji || '📝';
}

function EntryForm({ tripId, entry, onSave, onCancel }) {
  const [form, setForm] = useState({
    title: entry?.title || '',
    content: entry?.content || '',
    mood: entry?.mood || '',
    weather: entry?.weather || '',
    location: entry?.location || '',
    entryDate: entry?.entryDate || new Date().toISOString().split('T')[0],
    isPrivate: entry?.isPrivate || false,
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) { toast.error('Title is required'); return; }
    setSaving(true);
    try {
      let result;
      if (entry) {
        result = await updateJournalEntry(tripId, entry.id, form);
      } else {
        result = await createJournalEntry(tripId, form);
      }
      toast.success(entry ? 'Entry updated' : 'Entry created');
      onSave(result.data);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-bold text-base-content/70 mb-1">Title *</label>
        <input
          type="text"
          value={form.title}
          onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
          className="input input-bordered w-full"
          placeholder="Day title..."
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-bold text-base-content/70 mb-1">Date</label>
          <input
            type="date"
            value={form.entryDate}
            onChange={e => setForm(f => ({ ...f, entryDate: e.target.value }))}
            className="input input-bordered w-full"
          />
        </div>
        <div>
          <label className="block text-sm font-bold text-base-content/70 mb-1">Mood</label>
          <select
            value={form.mood}
            onChange={e => setForm(f => ({ ...f, mood: e.target.value }))}
            className="select select-bordered w-full"
          >
            <option value="">Select mood</option>
            {MOOD_OPTIONS.map(m => (
              <option key={m.value} value={m.value}>{m.emoji} {m.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-bold text-base-content/70 mb-1">
            <MapPin size={12} className="inline mr-1" />Location
          </label>
          <input
            type="text"
            value={form.location}
            onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
            className="input input-bordered w-full"
            placeholder="Where were you?"
          />
        </div>
        <div>
          <label className="block text-sm font-bold text-base-content/70 mb-1">
            <Cloud size={12} className="inline mr-1" />Weather
          </label>
          <input
            type="text"
            value={form.weather}
            onChange={e => setForm(f => ({ ...f, weather: e.target.value }))}
            className="input input-bordered w-full"
            placeholder="Sunny, rainy..."
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-bold text-base-content/70 mb-1">Journal Entry</label>
        <textarea
          value={form.content}
          onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
          className="textarea textarea-bordered w-full min-h-[200px]"
          placeholder="Write about your day..."
        />
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="isPrivate"
          checked={form.isPrivate}
          onChange={e => setForm(f => ({ ...f, isPrivate: e.target.checked }))}
          className="checkbox checkbox-sm"
        />
        <label htmlFor="isPrivate" className="text-sm font-bold text-base-content/70 cursor-pointer">
          {form.isPrivate ? <Lock size={14} className="inline mr-1" /> : <Unlock size={14} className="inline mr-1" />}
          Private entry
        </label>
      </div>

      <div className="flex gap-2 pt-2">
        <button type="button" onClick={onCancel} className="btn btn-ghost flex-1">Cancel</button>
        <button type="submit" disabled={saving} className="btn btn-primary flex-1">
          {saving ? <Loader2 size={16} className="animate-spin" /> : null}
          {entry ? 'Update Entry' : 'Save Entry'}
        </button>
      </div>
    </form>
  );
}

function EntryCard({ entry, onEdit, onDelete }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-base-100 rounded-xl border border-base-content/10 overflow-hidden"
    >
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full text-left p-4 hover:bg-base-200/50 transition-colors"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">{getMoodEmoji(entry.mood)}</span>
              <h3 className="font-black text-base-content truncate">{entry.title}</h3>
              {entry.isPrivate && <Lock size={12} className="text-base-content/40 shrink-0" />}
            </div>
            <div className="flex items-center gap-3 text-xs text-base-content/50">
              <span className="flex items-center gap-1">
                <Calendar size={10} />
                {entry.entryDate ? new Date(entry.entryDate).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) : '—'}
              </span>
              {entry.location && (
                <span className="flex items-center gap-1">
                  <MapPin size={10} />{entry.location}
                </span>
              )}
              {entry.photoCount > 0 && (
                <span className="flex items-center gap-1">
                  <Image size={10} />{entry.photoCount} photo{entry.photoCount > 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={e => { e.stopPropagation(); onEdit(entry); }}
              className="p-1.5 rounded-lg hover:bg-base-200 text-base-content/40 hover:text-base-content transition-colors"
            >
              <Edit2 size={14} />
            </button>
            <button
              onClick={e => { e.stopPropagation(); onDelete(entry); }}
              className="p-1.5 rounded-lg hover:bg-red-100 text-base-content/40 hover:text-red-500 transition-colors"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      </button>

      <AnimatePresence>
        {expanded && entry.content && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="px-4 pb-4"
          >
            <div className="pt-3 border-t border-base-content/10">
              {entry.weather && (
                <p className="text-xs text-base-content/50 mb-2">
                  <Cloud size={10} className="inline mr-1" />{entry.weather}
                </p>
              )}
              <p className="text-sm text-base-content/80 whitespace-pre-wrap leading-relaxed">{entry.content}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function TravelJournal() {
  const { id: tripId } = useParams();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchEntries();
  }, [tripId]);

  const fetchEntries = async () => {
    setLoading(true);
    try {
      const res = await getJournalEntries(tripId);
      setEntries(res.data || []);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleSave = (savedEntry) => {
    setEntries(prev => {
      const idx = prev.findIndex(e => e.id === savedEntry.id);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = savedEntry;
        return updated;
      }
      return [savedEntry, ...prev];
    });
    setShowForm(false);
    setEditingEntry(null);
  };

  const handleEdit = (entry) => {
    setEditingEntry(entry);
    setShowForm(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteJournalEntry(tripId, deleteTarget.id);
      setEntries(prev => prev.filter(e => e.id !== deleteTarget.id));
      toast.success('Entry deleted');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-6 px-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link to={`/trips/${tripId}`} className="p-2 rounded-lg hover:bg-base-200 text-base-content/60 hover:text-base-content transition-colors">
          <ChevronLeft size={20} />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <BookOpen size={20} className="text-brand-vibrant" />
            <h1 className="text-xl font-black text-base-content">Travel Journal</h1>
          </div>
          <p className="text-sm text-base-content/50">{entries.length} entr{entries.length === 1 ? 'y' : 'ies'}</p>
        </div>
        <button
          onClick={() => { setEditingEntry(null); setShowForm(true); }}
          className="btn btn-primary btn-sm gap-2"
        >
          <Plus size={16} /> New Entry
        </button>
      </div>

      {/* Entry Form Modal */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-base-100 rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-black">{editingEntry ? 'Edit Entry' : 'New Journal Entry'}</h2>
                <button onClick={() => { setShowForm(false); setEditingEntry(null); }} className="p-1.5 rounded-lg hover:bg-base-200">
                  <X size={18} />
                </button>
              </div>
              <EntryForm
                tripId={tripId}
                entry={editingEntry}
                onSave={handleSave}
                onCancel={() => { setShowForm(false); setEditingEntry(null); }}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirm Modal */}
      <AnimatePresence>
        {deleteTarget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-base-100 rounded-2xl shadow-xl w-full max-w-sm p-6"
            >
              <h2 className="text-lg font-black mb-2">Delete Entry?</h2>
              <p className="text-base-content/60 text-sm mb-4">"{deleteTarget.title}" will be permanently deleted.</p>
              <div className="flex gap-2">
                <button onClick={() => setDeleteTarget(null)} className="btn btn-ghost flex-1">Cancel</button>
                <button onClick={handleDeleteConfirm} disabled={deleting} className="btn btn-error flex-1">
                  {deleting ? <Loader2 size={16} className="animate-spin" /> : 'Delete'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Entries */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 rounded-xl bg-base-200 animate-pulse" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <div className="text-center py-16">
          <BookOpen size={48} className="mx-auto text-base-content/20 mb-4" />
          <h3 className="font-black text-base-content/40 mb-2">No journal entries yet</h3>
          <p className="text-sm text-base-content/30 mb-6">Start documenting your trip memories</p>
          <button
            onClick={() => { setEditingEntry(null); setShowForm(true); }}
            className="btn btn-primary gap-2"
          >
            <Plus size={16} /> Write First Entry
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {entries.map(entry => (
            <EntryCard
              key={entry.id}
              entry={entry}
              onEdit={handleEdit}
              onDelete={setDeleteTarget}
            />
          ))}
        </div>
      )}
    </div>
  );
}

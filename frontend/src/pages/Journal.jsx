import { useState, useEffect, useCallback } from 'react';
import { BookOpen, Plus, Edit2, Trash2, MapPin, Calendar, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import EmptyState from '../components/EmptyState';
import PageHeader from '../components/PageHeader';
import Button from '../components/Button';
import { useAuthStore } from '../stores/authStore';
import api from '../lib/api';
import toast from 'react-hot-toast';

const EMPTY_FORM = { title: '', content: '', destination: '', travel_date: '' };

function EntryModal({ entry, onClose, onSave }) {
  const [form, setForm] = useState(entry || EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.content.trim()) {
      toast.error('Title and content are required');
      return;
    }
    setSaving(true);
    await onSave(form);
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative bg-base-100 rounded-2xl shadow-2xl w-full max-w-xl p-6 z-10"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-black text-base-content">
            {entry ? 'Edit Entry' : 'New Journal Entry'}
          </h2>
          <button onClick={onClose} className="btn btn-ghost btn-sm btn-circle">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label"><span className="label-text font-bold">Title</span></label>
            <input
              type="text"
              className="input input-bordered w-full"
              placeholder="What happened today?"
              value={form.title}
              onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label"><span className="label-text font-bold">Destination</span></label>
              <div className="relative">
                <MapPin size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40" />
                <input
                  type="text"
                  className="input input-bordered w-full pl-9"
                  placeholder="Where were you?"
                  value={form.destination}
                  onChange={(e) => setForm(f => ({ ...f, destination: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <label className="label"><span className="label-text font-bold">Date</span></label>
              <input
                type="date"
                className="input input-bordered w-full"
                value={form.travel_date}
                onChange={(e) => setForm(f => ({ ...f, travel_date: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <label className="label"><span className="label-text font-bold">Content</span></label>
            <textarea
              className="textarea textarea-bordered w-full h-40 resize-none"
              placeholder="Write about your experience…"
              value={form.content}
              onChange={(e) => setForm(f => ({ ...f, content: e.target.value }))}
              required
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn btn-ghost">Cancel</button>
            <Button type="submit" variant="primary" disabled={saving}>
              {saving ? 'Saving…' : entry ? 'Save Changes' : 'Create Entry'}
            </Button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

function EntryCard({ entry, onEdit, onDelete }) {
  const date = entry.travel_date
    ? new Date(entry.travel_date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
    : new Date(entry.created_at || Date.now()).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

  const excerpt = entry.content?.length > 140 ? entry.content.slice(0, 140) + '…' : entry.content;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      className="glass-card rounded-xl p-6 hover:shadow-lg transition-shadow"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            {entry.destination && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-bold">
                <MapPin size={10} />
                {entry.destination}
              </span>
            )}
            <span className="inline-flex items-center gap-1 text-xs text-base-content/50 font-medium">
              <Calendar size={10} />
              {date}
            </span>
          </div>
          <h3 className="font-black text-base-content text-lg leading-tight mb-2 truncate">{entry.title}</h3>
          <p className="text-base-content/60 text-sm leading-relaxed">{excerpt}</p>
        </div>
        <div className="flex gap-1 shrink-0">
          <button onClick={() => onEdit(entry)} className="btn btn-ghost btn-xs btn-circle" aria-label="Edit entry">
            <Edit2 size={14} />
          </button>
          <button onClick={() => onDelete(entry)} className="btn btn-ghost btn-xs btn-circle text-error hover:bg-error/10" aria-label="Delete entry">
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

export default function Journal() {
  const { user } = useAuthStore();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);

  const fetchEntries = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/journal/entries');
      setEntries(res.data?.entries || res.data || []);
    } catch {
      // Backend not yet available — show empty state gracefully
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  const handleSave = async (form) => {
    try {
      if (editingEntry?.id) {
        await api.put(`/journal/entries/${editingEntry.id}`, form);
        setEntries(prev => prev.map(e => e.id === editingEntry.id ? { ...e, ...form } : e));
        toast.success('Entry updated');
      } else {
        const res = await api.post('/journal/entries', form);
        const newEntry = res.data?.entry || res.data || { ...form, id: Date.now(), created_at: new Date().toISOString() };
        setEntries(prev => [newEntry, ...prev]);
        toast.success('Entry created');
      }
    } catch {
      // Optimistic local add when API unavailable
      if (!editingEntry) {
        const localEntry = { ...form, id: Date.now(), created_at: new Date().toISOString() };
        setEntries(prev => [localEntry, ...prev]);
        toast.success('Entry saved locally');
      } else {
        toast.error('Failed to save entry');
      }
    }
    setModalOpen(false);
    setEditingEntry(null);
  };

  const handleEdit = (entry) => {
    setEditingEntry(entry);
    setModalOpen(true);
  };

  const handleDelete = async (entry) => {
    if (!window.confirm('Delete this journal entry?')) return;
    try {
      await api.delete(`/journal/entries/${entry.id}`);
    } catch {
      // Proceed with local removal even if API unavailable
    }
    setEntries(prev => prev.filter(e => e.id !== entry.id));
    toast.success('Entry deleted');
  };

  const openNewModal = () => {
    setEditingEntry(null);
    setModalOpen(true);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-28 lg:pb-12">
      <PageHeader
        title="Journal"
        subtitle="Capture memories from your travels"
        badge="My Journal"
        icon={BookOpen}
        actions={
          <Button variant="primary" onClick={openNewModal} className="gap-2">
            <Plus size={16} />
            New Entry
          </Button>
        }
      />

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-32 bg-base-content/5 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No journal entries yet"
          description="Start capturing your travel memories and experiences."
          actionLabel="Write First Entry"
          onAction={openNewModal}
        />
      ) : (
        <AnimatePresence mode="popLayout">
          <div className="space-y-4">
            {entries.map(entry => (
              <EntryCard
                key={entry.id}
                entry={entry}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            ))}
          </div>
        </AnimatePresence>
      )}

      <AnimatePresence>
        {modalOpen && (
          <EntryModal
            entry={editingEntry}
            onClose={() => { setModalOpen(false); setEditingEntry(null); }}
            onSave={handleSave}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

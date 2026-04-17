import { useState, useEffect } from 'react';
import api from '../../lib/api';
import toast from 'react-hot-toast';
import AdminDataTable from './AdminDataTable';
import AdminModal from './AdminModal';
import Button from '../Button';
import { Plus, Edit2, Send, RefreshCw, BookOpen } from 'lucide-react';

const TYPE_OPTIONS = ['feature', 'improvement', 'fix', 'security', 'breaking'];
const EMPTY_FORM = { version: '', title: '', description: '', type: 'feature', published: false };

const ChangelogManagement = () => {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchEntries(); }, []);

  const fetchEntries = async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/changelog');
      if (res.data?.success) setEntries(res.data.data.entries || []);
    } catch { toast.error('Failed to load changelog entries'); }
    finally { setLoading(false); }
  };

  const openCreate = () => { setEditing(null); setForm(EMPTY_FORM); setShowModal(true); };
  const openEdit = (entry) => {
    setEditing(entry);
    setForm({ version: entry.version, title: entry.title, description: entry.description || '', type: entry.type, published: !!entry.published });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.version.trim() || !form.title.trim()) { toast.error('Version and title are required'); return; }
    setSaving(true);
    try {
      if (editing) {
        await api.patch(`/admin/changelog/${editing.id}`, form);
        toast.success('Entry updated');
      } else {
        await api.post('/admin/changelog', form);
        toast.success('Entry created');
      }
      setShowModal(false);
      fetchEntries();
    } catch { toast.error('Failed to save entry'); }
    finally { setSaving(false); }
  };

  const togglePublish = async (entry) => {
    try {
      await api.patch(`/admin/changelog/${entry.id}`, { ...entry, published: !entry.published });
      toast.success(entry.published ? 'Entry unpublished' : 'Entry published');
      fetchEntries();
    } catch { toast.error('Failed to update entry'); }
  };

  const TYPE_BADGE = { feature: 'bg-emerald-100 text-emerald-700', improvement: 'bg-sky-100 text-sky-700', fix: 'bg-amber-100 text-amber-700', security: 'bg-red-100 text-red-700', breaking: 'bg-rose-100 text-rose-700' };

  const columns = [
    { key: 'version', label: 'Version', render: (v) => <span className="text-xs font-mono font-bold">v{v}</span> },
    { key: 'title', label: 'Title', render: (v) => <span className="text-sm font-semibold">{v}</span> },
    { key: 'type', label: 'Type', render: (v) => <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase ${TYPE_BADGE[v] || 'bg-base-200'}`}>{v}</span> },
    { key: 'published', label: 'Published', render: (v, row) => (
      <button type="button" onClick={() => togglePublish(row)} className={`text-xs font-bold px-2 py-0.5 rounded-full transition-colors ${v ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-base-200 text-base-content/50 hover:bg-base-300'}`} aria-label={v ? `Unpublish ${row.title}` : `Publish ${row.title}`}>
        {v ? 'Live' : 'Draft'}
      </button>
    )},
    {
      key: 'actions', label: '',
      render: (_, row) => (
        <button type="button" onClick={() => openEdit(row)} className="p-1.5 rounded text-base-content/40 hover:text-primary hover:bg-primary/10 transition-colors" aria-label={`Edit ${row.title}`}><Edit2 size={13} /></button>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-black text-base-content flex items-center gap-2">
            <BookOpen size={20} className="text-violet-500" aria-hidden="true" />
            Changelog
          </h2>
          <p className="text-sm text-base-content/50 mt-0.5">{entries.length} entr{entries.length !== 1 ? 'ies' : 'y'}</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={fetchEntries} className="p-2 rounded-lg text-base-content/40 hover:text-primary hover:bg-primary/10 transition-colors" aria-label="Refresh"><RefreshCw size={15} /></button>
          <Button onClick={openCreate} size="sm" className="gap-1.5"><Plus size={14} />New Entry</Button>
        </div>
      </div>

      <AdminDataTable columns={columns} data={entries} loading={loading} total={entries.length} page={1} limit={entries.length || 10} onPageChange={() => {}} emptyMessage="No changelog entries yet." />

      {showModal && (
        <AdminModal isOpen={showModal} onClose={() => setShowModal(false)} title={editing ? 'Edit Changelog Entry' : 'New Changelog Entry'}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-base-content/60 mb-1.5" htmlFor="cl-version">Version <span aria-hidden="true">*</span></label>
                <input id="cl-version" type="text" value={form.version} onChange={(e) => setForm({ ...form, version: e.target.value })} placeholder="e.g. 2.1.0" className="w-full text-sm bg-base-200 border border-base-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-base-content/60 mb-1.5" htmlFor="cl-type">Type</label>
                <select id="cl-type" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="w-full text-sm bg-base-200 border border-base-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30">
                  {TYPE_OPTIONS.map((t) => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-base-content/60 mb-1.5" htmlFor="cl-title">Title <span aria-hidden="true">*</span></label>
              <input id="cl-title" type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} maxLength={200} className="w-full text-sm bg-base-200 border border-base-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-base-content/60 mb-1.5" htmlFor="cl-desc">Description</label>
              <textarea id="cl-desc" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={4} className="w-full text-sm bg-base-200 border border-base-300 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="cl-publish" checked={form.published} onChange={(e) => setForm({ ...form, published: e.target.checked })} className="checkbox checkbox-sm checkbox-primary" />
              <label htmlFor="cl-publish" className="text-sm font-semibold text-base-content/70">Publish immediately</label>
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="ghost" onClick={() => setShowModal(false)}>Cancel</Button>
              <Button onClick={handleSave} loading={saving} className="gap-1.5"><Send size={13} />{editing ? 'Save Changes' : 'Create Entry'}</Button>
            </div>
          </div>
        </AdminModal>
      )}
    </div>
  );
};

export default ChangelogManagement;

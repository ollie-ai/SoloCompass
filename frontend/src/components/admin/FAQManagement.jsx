import { useState, useEffect } from 'react';
import api from '../../lib/api';
import toast from 'react-hot-toast';
import AdminDataTable from './AdminDataTable';
import AdminModal from './AdminModal';
import Button from '../Button';
import { Plus, Edit2, Trash2, HelpCircle, ToggleLeft, ToggleRight, RefreshCw } from 'lucide-react';

const EMPTY_FORM = { title: '', content: '', category: 'General', display_order: 0, active: true };

const FAQManagement = () => {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingArticle, setEditingArticle] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchArticles(); }, []);

  const fetchArticles = async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/faq');
      if (res.data?.success) setArticles(res.data.data.articles || []);
    } catch { toast.error('Failed to load FAQ articles'); }
    finally { setLoading(false); }
  };

  const openCreate = () => {
    setEditingArticle(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  };

  const openEdit = (article) => {
    setEditingArticle(article);
    setForm({ title: article.title, content: article.content, category: article.category, display_order: article.display_order, active: article.active });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.content.trim()) {
      toast.error('Title and content are required');
      return;
    }
    setSaving(true);
    try {
      if (editingArticle) {
        await api.put(`/admin/faq/${editingArticle.id}`, form);
        toast.success('Article updated');
      } else {
        await api.post('/admin/faq', form);
        toast.success('Article created');
      }
      setShowModal(false);
      fetchArticles();
    } catch { toast.error('Failed to save article'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this FAQ article?')) return;
    try {
      await api.delete(`/admin/faq/${id}`);
      toast.success('Article deleted');
      fetchArticles();
    } catch { toast.error('Failed to delete article'); }
  };

  const columns = [
    { key: 'id', label: '#', render: (v) => <span className="text-xs font-mono text-base-content/50">#{v}</span> },
    { key: 'title', label: 'Title', render: (v) => <span className="text-sm font-semibold">{v}</span> },
    { key: 'category', label: 'Category', render: (v) => <span className="text-xs font-bold bg-base-200 px-2 py-0.5 rounded-full">{v}</span> },
    { key: 'display_order', label: 'Order', render: (v) => <span className="text-xs text-base-content/50">{v}</span> },
    { key: 'active', label: 'Active', render: (v) => v
      ? <span className="text-green-600"><ToggleRight size={18} /></span>
      : <span className="text-base-content/30"><ToggleLeft size={18} /></span>
    },
    {
      key: 'actions', label: '',
      render: (_, row) => (
        <div className="flex gap-1">
          <button type="button" onClick={() => openEdit(row)} className="p-1.5 rounded text-base-content/40 hover:text-primary hover:bg-primary/10 transition-colors" aria-label={`Edit ${row.title}`}><Edit2 size={13} /></button>
          <button type="button" onClick={() => handleDelete(row.id)} className="p-1.5 rounded text-base-content/40 hover:text-error hover:bg-error/10 transition-colors" aria-label={`Delete ${row.title}`}><Trash2 size={13} /></button>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-black text-base-content flex items-center gap-2">
            <HelpCircle size={20} className="text-sky-500" aria-hidden="true" />
            FAQ Articles
          </h2>
          <p className="text-sm text-base-content/50 mt-0.5">{articles.length} article{articles.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={fetchArticles} className="p-2 rounded-lg text-base-content/40 hover:text-primary hover:bg-primary/10 transition-colors" aria-label="Refresh"><RefreshCw size={15} /></button>
          <Button onClick={openCreate} size="sm" className="gap-1.5"><Plus size={14} />New Article</Button>
        </div>
      </div>

      <AdminDataTable columns={columns} data={articles} loading={loading} total={articles.length} page={1} limit={articles.length || 10} onPageChange={() => {}} emptyMessage="No FAQ articles yet. Create the first one!" />

      {showModal && (
        <AdminModal isOpen={showModal} onClose={() => setShowModal(false)} title={editingArticle ? 'Edit FAQ Article' : 'New FAQ Article'}>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-base-content/60 mb-1.5" htmlFor="faq-title">Title <span aria-hidden="true">*</span></label>
              <input id="faq-title" type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required maxLength={200} className="w-full text-sm bg-base-200 border border-base-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-base-content/60 mb-1.5" htmlFor="faq-category">Category <span aria-hidden="true">*</span></label>
              <input id="faq-category" type="text" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full text-sm bg-base-200 border border-base-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-base-content/60 mb-1.5" htmlFor="faq-content">Content (answer) <span aria-hidden="true">*</span></label>
              <textarea id="faq-content" value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} rows={5} className="w-full text-sm bg-base-200 border border-base-300 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-base-content/60 mb-1.5" htmlFor="faq-order">Display Order</label>
                <input id="faq-order" type="number" value={form.display_order} onChange={(e) => setForm({ ...form, display_order: Number(e.target.value) })} min={0} className="w-full text-sm bg-base-200 border border-base-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
              <div className="flex items-end pb-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} className="checkbox checkbox-sm checkbox-primary" />
                  <span className="text-sm font-semibold text-base-content/70">Published</span>
                </label>
              </div>
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="ghost" onClick={() => setShowModal(false)}>Cancel</Button>
              <Button onClick={handleSave} loading={saving}>{editingArticle ? 'Save Changes' : 'Create Article'}</Button>
            </div>
          </div>
        </AdminModal>
      )}
    </div>
  );
};

export default FAQManagement;

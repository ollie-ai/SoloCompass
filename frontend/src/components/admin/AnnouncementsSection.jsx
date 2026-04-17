import { useState, useEffect } from 'react';
import api from '../../lib/api';
import toast from 'react-hot-toast';
import { 
  Plus, 
  Edit2, 
  Trash2, 
  X,
  Megaphone,
  Calendar,
  Clock,
  Info,
  AlertTriangle,
  AlertCircle,
  Loader
} from 'lucide-react';
import AdminDataTable from './AdminDataTable';
import AdminModal from './AdminModal';
import Button from '../Button';
import ConfirmDialog from '../ConfirmDialog';

const typeConfig = {
  info: { 
    color: 'bg-sky-500', 
    text: 'text-sky-600', 
    bg: 'bg-sky-500/10', 
    icon: Info,
    label: 'Info'
  },
  warning: { 
    color: 'bg-amber-500', 
    text: 'text-amber-600', 
    bg: 'bg-amber-500/10', 
    icon: AlertTriangle,
    label: 'Warning'
  },
  critical: { 
    color: 'bg-red-500', 
    text: 'text-red-600', 
    bg: 'bg-red-500/10', 
    icon: AlertCircle,
    label: 'Critical'
  }
};

const AnnouncementsSection = () => {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState(null);
  const [saving, setSaving] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState({ open: false, id: null });
  
  const [formData, setFormData] = useState({
    title: '',
    message: '',
    type: 'info',
    active: true,
    start_date: '',
    end_date: ''
  });

  useEffect(() => {
    fetchAnnouncements();
  }, [page]);

  const fetchAnnouncements = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/admin/announcements?limit=${limit}&offset=${(page - 1) * limit}`);
      if (response.data.success) {
        setAnnouncements(response.data.data.announcements);
        setTotal(response.data.data.total);
      }
    } catch (error) {
      console.error('Failed to fetch announcements:', error);
      toast.error('Failed to load announcements');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (announcement = null) => {
    if (announcement) {
      setEditingAnnouncement(announcement);
      setFormData({
        title: announcement.title || '',
        message: announcement.message || '',
        type: announcement.type || 'info',
        active: announcement.active ?? true,
        start_date: announcement.start_date ? announcement.start_date.slice(0, 16) : '',
        end_date: announcement.end_date ? announcement.end_date.slice(0, 16) : ''
      });
    } else {
      setEditingAnnouncement(null);
      setFormData({
        title: '',
        message: '',
        type: 'info',
        active: true,
        start_date: '',
        end_date: ''
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingAnnouncement(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      const payload = {
        title: formData.title,
        message: formData.message,
        type: formData.type,
        active: formData.active,
        start_date: formData.start_date ? new Date(formData.start_date).toISOString() : null,
        end_date: formData.end_date ? new Date(formData.end_date).toISOString() : null
      };

      let response;
      if (editingAnnouncement) {
        response = await api.patch(`/admin/announcements/${editingAnnouncement.id}`, payload);
        toast.success('Announcement updated');
      } else {
        response = await api.post('/admin/announcements', payload);
        toast.success('Announcement created');
      }

      if (response.data.success) {
        handleCloseModal();
        fetchAnnouncements();
      }
    } catch (error) {
      console.error('Failed to save announcement:', error);
      toast.error(error.response?.data?.error || 'Failed to save announcement');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (id) => {
    setConfirmDialog({ open: true, id });
  };

  const executeDelete = async () => {
    const id = confirmDialog.id;
    setConfirmDialog({ open: false, id: null });
    try {
      const response = await api.delete(`/admin/announcements/${id}`);
      if (response.data.success) {
        toast.success('Announcement deleted');
        fetchAnnouncements();
      }
    } catch (error) {
      console.error('Failed to delete announcement:', error);
      toast.error('Failed to delete announcement');
    }
  };

  const handleToggleActive = async (announcement) => {
    try {
      const response = await api.patch(`/admin/announcements/${announcement.id}`, {
        active: !announcement.active
      });
      if (response.data.success) {
        toast.success(announcement.active ? 'Announcement deactivated' : 'Announcement activated');
        fetchAnnouncements();
      }
    } catch (error) {
      console.error('Failed to toggle announcement:', error);
      toast.error('Failed to update announcement');
    }
  };

  const columns = [
    {
      key: 'title',
      label: 'Title',
      render: (value, row) => (
        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full ${typeConfig[row.type]?.color || 'bg-sky-500'}`} />
          <span className="font-bold text-base-content">{value}</span>
        </div>
      )
    },
    {
      key: 'type',
      label: 'Type',
      render: (value) => {
        const config = typeConfig[value];
        const Icon = config?.icon || Info;
        return (
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold ${config?.bg} ${config?.text}`}>
            <Icon size={12} />
            {config?.label || value}
          </span>
        );
      }
    },
    {
      key: 'active',
      label: 'Status',
      render: (value) => (
        <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${value ? 'bg-emerald-500/10 text-emerald-600' : 'bg-base-300 text-base-content/40'}`}>
          {value ? 'Active' : 'Inactive'}
        </span>
      )
    },
    {
      key: 'start_date',
      label: 'Start',
      render: (value) => value ? (
        <div className="flex items-center gap-1.5 text-xs text-base-content/60">
          <Calendar size={12} />
          {new Date(value).toLocaleDateString()}
        </div>
      ) : <span className="text-base-content/40 text-xs">Immediate</span>
    },
    {
      key: 'end_date',
      label: 'End',
      render: (value) => value ? (
        <div className="flex items-center gap-1.5 text-xs text-base-content/60">
          <Clock size={12} />
          {new Date(value).toLocaleDateString()}
        </div>
      ) : <span className="text-base-content/40 text-xs">No expiry</span>
    },
    {
      key: 'created_by_name',
      label: 'Created By',
      render: (value, row) => value || row.created_by_email || 'System'
    },
    {
      key: 'actions',
      label: 'Actions',
      className: 'w-32',
      render: (_, row) => (
        <div className="flex items-center gap-1">
          <button
            onClick={() => handleOpenModal(row)}
            className="p-2 hover:bg-sky-500/10 rounded-lg text-sky-500 transition-colors"
            title="Edit"
          >
            <Edit2 size={14} />
          </button>
          <button
            onClick={() => handleToggleActive(row)}
            className={`p-2 hover:bg-amber-500/10 rounded-lg transition-colors ${row.active ? 'text-amber-500' : 'text-emerald-500'}`}
            title={row.active ? 'Deactivate' : 'Activate'}
          >
            {row.active ? <X size={14} /> : <Plus size={14} />}
          </button>
          <button
            onClick={() => handleDelete(row.id)}
            className="p-2 hover:bg-red-500/10 rounded-lg text-red-500 transition-colors"
            title="Delete"
          >
            <Trash2 size={14} />
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <ConfirmDialog
        open={confirmDialog.open}
        onConfirm={executeDelete}
        onCancel={() => setConfirmDialog({ open: false, id: null })}
        title="Delete Announcement?"
        description="This announcement will be permanently deleted and removed for all users."
        confirmLabel="Delete"
        variant="danger"
      />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-500/10 flex items-center justify-center">
            <Megaphone size={20} className="text-sky-500" />
          </div>
          <div>
            <h3 className="font-black text-lg text-base-content">Site-wide Announcements</h3>
            <p className="text-sm text-base-content/50">Manage banners shown to all users</p>
          </div>
        </div>
        <Button onClick={() => handleOpenModal()} className="flex items-center gap-2">
          <Plus size={16} />
          New Announcement
        </Button>
      </div>

      {/* Table */}
      <AdminDataTable
        data={announcements}
        columns={columns}
        loading={loading}
        total={total}
        page={page}
        limit={limit}
        onPageChange={setPage}
        onRefresh={fetchAnnouncements}
        emptyMessage="No announcements yet"
        emptyIcon={Megaphone}
      />

      {/* Create/Edit Modal */}
      <AdminModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={editingAnnouncement ? 'Edit Announcement' : 'Create Announcement'}
        size="lg"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={handleCloseModal}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving ? <Loader className="animate-spin mr-2" size={16} /> : null}
              {editingAnnouncement ? 'Update' : 'Create'}
            </Button>
          </div>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div>
            <label className="block text-sm font-bold text-base-content mb-1.5">Title</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              maxLength={100}
              className="w-full px-4 py-2.5 rounded-xl border border-base-300 bg-base-100 focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500 outline-none transition-all"
              placeholder="Announcement title"
              required
            />
            <p className="text-xs text-base-content/40 mt-1">{formData.title.length}/100 characters</p>
          </div>

          {/* Message */}
          <div>
            <label className="block text-sm font-bold text-base-content mb-1.5">Message</label>
            <textarea
              value={formData.message}
              onChange={(e) => setFormData({ ...formData, message: e.target.value })}
              maxLength={2000}
              rows={4}
              className="w-full px-4 py-2.5 rounded-xl border border-base-300 bg-base-100 focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500 outline-none transition-all resize-none"
              placeholder="Announcement message content..."
              required
            />
            <p className="text-xs text-base-content/40 mt-1">{formData.message.length}/2000 characters</p>
          </div>

          {/* Type */}
          <div>
            <label className="block text-sm font-bold text-base-content mb-1.5">Type</label>
            <div className="flex gap-2">
              {Object.entries(typeConfig).map(([key, config]) => {
                const Icon = config.icon;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setFormData({ ...formData, type: key })}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border transition-all ${
                      formData.type === key
                        ? `${config.bg} ${config.text} border-current`
                        : 'border-base-300 hover:border-base-content/30'
                    }`}
                  >
                    <Icon size={16} />
                    <span className="font-bold text-sm">{config.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Active Toggle */}
          <div className="flex items-center justify-between p-4 bg-base-200/30 rounded-xl">
            <div>
              <p className="font-bold text-base-content text-sm">Active</p>
              <p className="text-xs text-base-content/50">Show this announcement to users</p>
            </div>
            <button
              type="button"
              onClick={() => setFormData({ ...formData, active: !formData.active })}
              className={`w-12 h-6 rounded-full transition-all relative ${formData.active ? 'bg-sky-500' : 'bg-base-300'}`}
            >
              <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-md transition-all ${formData.active ? 'left-7' : 'left-1'}`} />
            </button>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-base-content mb-1.5">Start Date (optional)</label>
              <input
                type="datetime-local"
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-base-300 bg-base-100 focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500 outline-none transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-base-content mb-1.5">End Date (optional)</label>
              <input
                type="datetime-local"
                value={formData.end_date}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-base-300 bg-base-100 focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500 outline-none transition-all"
              />
            </div>
          </div>
        </form>
      </AdminModal>
    </div>
  );
};

export default AnnouncementsSection;
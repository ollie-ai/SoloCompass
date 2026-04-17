import { useState, useEffect, useMemo } from 'react';
import api from '../../lib/api';
import toast from 'react-hot-toast';
import AdminDataTable from './AdminDataTable';
import AdminModal from './AdminModal';
import Button from '../Button';
import ConfirmDialog from '../ConfirmDialog';
import { 
  Edit2, 
  Check, 
  X, 
  Trash2,
  RefreshCw,
  MapPin,
  Star,
  MessageSquare
} from 'lucide-react';

const ReviewsTab = () => {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [counts, setCounts] = useState({});
  const [confirmPurgeId, setConfirmPurgeId] = useState(null);
  const limit = 10;

  useEffect(() => {
    fetchReviews();
  }, [page, statusFilter]);

  const fetchReviews = async () => {
    try {
      setLoading(true);
      const response = await api.get('/reviews/admin/list', {
        params: { page, limit, status: statusFilter }
      });
      if (response.data.success) {
        setReviews(response.data.data.reviews);
        setTotal(response.data.data.total);
        setCounts(response.data.data.countsByStatus || {});
      }
    } catch (error) {
      toast.error('Failed to fetch moderation queue');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id) => {
    try {
      await api.post(`/reviews/admin/${id}/approve`);
      toast.success('Review approved');
      fetchReviews();
    } catch (error) {
      toast.error('Failed to approve review');
    }
  };

  const handleReject = async (id) => {
    try {
      await api.post(`/reviews/admin/${id}/reject`);
      toast.success('Review rejected');
      fetchReviews();
    } catch (error) {
      toast.error('Failed to reject review');
    }
  };

  const handlePurge = (id) => {
    setConfirmPurgeId(id);
  };

  const executePurge = async () => {
    const id = confirmPurgeId;
    setConfirmPurgeId(null);
    try {
      await api.delete(`/reviews/admin/${id}`);
      toast.success('Review purged');
      fetchReviews();
    } catch (error) {
      toast.error('Failed to purge review');
    }
  };

  const handlePageChange = (newPage) => {
    setPage(newPage);
  };

  const columns = useMemo(() => [
    {
      key: 'destination',
      label: 'Destination',
      sortable: false,
      render: (_, row) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl overflow-hidden bg-base-200 flex items-center justify-center">
            <MapPin size={16} className="text-base-content/40" />
          </div>
          <div>
            <p className="font-bold text-base-content">{row.destination || 'Unknown'}</p>
            <p className="text-[10px] text-base-content/50">{row.venue_name || row.venue_type}</p>
          </div>
        </div>
      )
    },
    {
      key: 'rating',
      label: 'Rating',
      sortable: true,
      render: (_, row) => (
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map(star => (
            <Star 
              key={star} 
              size={14} 
              className={star <= row.overall_rating ? 'text-warning fill-warning' : 'text-base-content/20'} 
            />
          ))}
        </div>
      )
    },
    {
      key: 'review',
      label: 'Review',
      sortable: false,
      render: (_, row) => (
        <div className="max-w-xs">
          <p className="font-bold text-sm text-base-content">{row.title}</p>
          <p className="text-xs text-base-content/50 truncate">{row.content}</p>
        </div>
      )
    },
    {
      key: 'user',
      label: 'User',
      sortable: false,
      render: (_, row) => (
        <span className="text-xs text-base-content/60">{row.author?.name || row.author?.email || 'Unknown'}</span>
      )
    },
    {
      key: 'status',
      label: 'Status',
      sortable: false,
      render: (_, row) => (
        <span className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase ${
          row.status === 'approved' ? 'bg-success/10 text-success' :
          row.status === 'rejected' ? 'bg-error/10 text-error' :
          'bg-warning/10 text-warning'
        }`}>
          {row.status}
        </span>
      )
    },
    {
      key: 'actions',
      label: 'Actions',
      sortable: false,
      className: 'text-right',
      render: (_, row) => (
        row.status === 'pending' ? (
          <div className="flex justify-end gap-1">
            <button 
              onClick={() => handleApprove(row.id)}
              className="p-2 hover:bg-success/10 rounded-xl transition-all text-success hover:text-success"
              title="Approve"
            >
              <Check size={16} />
            </button>
            <button 
              onClick={() => handleReject(row.id)}
              className="p-2 hover:bg-error/10 rounded-xl transition-all text-error hover:text-error"
              title="Reject"
            >
              <X size={16} />
            </button>
            <button 
              onClick={() => handlePurge(row.id)}
              className="p-2 hover:bg-base-100 rounded-xl transition-all text-base-content/40 hover:text-error"
              title="Purge"
            >
              <Trash2 size={16} />
            </button>
          </div>
        ) : null
      )
    }
  ], []);

  const filterOptions = [
    { value: 'pending', label: `Pending (${counts.pending || 0})` },
    { value: 'approved', label: `Approved (${counts.approved || 0})` },
    { value: 'rejected', label: `Rejected (${counts.rejected || 0})` }
  ];

  return (
    <div className="space-y-6">
      <ConfirmDialog
        open={confirmPurgeId !== null}
        onConfirm={executePurge}
        onCancel={() => setConfirmPurgeId(null)}
        title="Purge Review?"
        description="This will permanently delete the review. This action is irreversible."
        confirmLabel="Purge"
        variant="danger"
      />
      <AdminDataTable
        data={reviews}
        columns={columns}
        loading={loading}
        total={total}
        page={page}
        limit={limit}
        onPageChange={handlePageChange}
        onFilter={setStatusFilter}
        onRefresh={fetchReviews}
        filterOptions={filterOptions}
        emptyMessage="No reviews to moderate"
        emptyIcon={MessageSquare}
      />
    </div>
  );
};

const DestinationsTab = () => {
  const [destinations, setDestinations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDest, setSelectedDest] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [confirmRejectId, setConfirmRejectId] = useState(null);
  const limit = 10;

  useEffect(() => {
    fetchPendingDestinations();
  }, []);

  const fetchPendingDestinations = async () => {
    try {
      setLoading(true);
      const response = await api.get('/admin/moderation/destinations');
      if (response.data.success) {
        setDestinations(response.data.data);
      }
    } catch (error) {
      toast.error('Failed to fetch pending destinations');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id) => {
    try {
      await api.post(`/admin/moderation/destinations/${id}/approve`);
      toast.success('Destination approved and live!');
      fetchPendingDestinations();
    } catch (error) {
      toast.error('Approval failed');
    }
  };

  const handleReject = (id) => {
    setConfirmRejectId(id);
  };

  const executeReject = async () => {
    const id = confirmRejectId;
    setConfirmRejectId(null);
    try {
      await api.post(`/admin/moderation/destinations/${id}/reject`);
      toast.success('Destination flagged');
      fetchPendingDestinations();
    } catch (error) {
      toast.error('Action failed');
    }
  };

  const handleView = (dest) => {
    setSelectedDest(dest);
    setShowPreview(true);
  };

  const columns = useMemo(() => [
    {
      key: 'destination',
      label: 'Destination',
      sortable: false,
      render: (_, row) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl overflow-hidden bg-base-200">
            {row.image_url && (
              <img src={row.image_url} className="w-full h-full object-cover" alt={row.name} />
            )}
          </div>
          <div>
            <p className="font-bold text-base-content">{row.name}</p>
            <p className="text-[10px] text-base-content/50">{row.city}, {row.country}</p>
          </div>
        </div>
      )
    },
    {
      key: 'safety',
      label: 'Safety',
      sortable: false,
      render: (_, row) => (
        <span className={`px-2 py-1 rounded-lg text-[10px] font-bold ${
          row.safety_rating === 'high' ? 'bg-success/10 text-success' :
          row.safety_rating === 'medium' ? 'bg-warning/10 text-warning' :
          'bg-error/10 text-error'
        }`}>
          {row.safety_rating}
        </span>
      )
    },
    {
      key: 'budget',
      label: 'Budget',
      sortable: false,
      render: (_, row) => (
        <span className="text-xs text-base-content/60 capitalize">{row.budget_level}</span>
      )
    },
    {
      key: 'source',
      label: 'Source',
      sortable: false,
      render: (_, row) => (
        <span className="px-2 py-1 bg-base-200 rounded-lg text-[10px] font-bold">{row.source || 'AI'}</span>
      )
    },
    {
      key: 'created_at',
      label: 'Submitted',
      sortable: false,
      render: (_, row) => (
        <span className="text-xs text-base-content/40">
          {new Date(row.created_at).toLocaleDateString()}
        </span>
      )
    },
    {
      key: 'actions',
      label: 'Actions',
      sortable: false,
      className: 'text-right',
      render: (_, row) => (
        <div className="flex justify-end gap-1">
          <button 
            onClick={() => handleView(row)}
            className="p-2 hover:bg-base-100 rounded-xl transition-all text-base-content/40 hover:text-primary"
            title="Preview"
          >
            <MapPin size={16} />
          </button>
          <button 
            onClick={() => handleApprove(row.id)}
            className="p-2 hover:bg-success/10 rounded-xl transition-all text-success hover:text-success"
            title="Approve"
          >
            <Check size={16} />
          </button>
          <button 
            onClick={() => handleReject(row.id)}
            className="p-2 hover:bg-error/10 rounded-xl transition-all text-error hover:text-error"
            title="Reject"
          >
            <X size={16} />
          </button>
        </div>
      )
    }
  ], []);

  return (
    <div className="space-y-6">
      <ConfirmDialog
        open={confirmRejectId !== null}
        onConfirm={executeReject}
        onCancel={() => setConfirmRejectId(null)}
        title="Flag AI Data?"
        description="This will mark the destination's AI-generated data as flagged for review."
        confirmLabel="Flag It"
        variant="warning"
      />
      <AdminDataTable
        data={destinations}
        columns={columns}
        loading={loading}
        total={destinations.length}
        page={1}
        limit={limit}
        onRefresh={fetchPendingDestinations}
        emptyMessage="No pending destinations"
        emptyIcon={MapPin}
      />

      {/* Preview Modal */}
      <AdminModal
        isOpen={showPreview}
        onClose={() => {
          setShowPreview(false);
          setSelectedDest(null);
        }}
        title={selectedDest?.name}
        size="lg"
      >
        {selectedDest && (
          <div className="space-y-4">
            {selectedDest.image_url && (
              <div className="w-full h-48 rounded-xl overflow-hidden">
                <img 
                  src={selectedDest.image_url} 
                  className="w-full h-full object-cover"
                  alt={selectedDest.name}
                />
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-base-200/30 rounded-xl">
                <p className="text-xs text-base-content/50">Safety Rating</p>
                <p className="font-bold text-base-content capitalize">{selectedDest.safety_rating}</p>
              </div>
              <div className="p-3 bg-base-200/30 rounded-xl">
                <p className="text-xs text-base-content/50">Budget Level</p>
                <p className="font-bold text-base-content capitalize">{selectedDest.budget_level}</p>
              </div>
            </div>
            <div>
              <p className="text-xs text-base-content/50">Description</p>
              <p className="text-sm text-base-content/70">{selectedDest.description}</p>
            </div>
          </div>
        )}
      </AdminModal>
    </div>
  );
};

const ModerationSection = () => {
  const [activeTab, setActiveTab] = useState('reviews');

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-base-300 pb-px">
        <button
          onClick={() => setActiveTab('reviews')}
          className={`pb-3 px-4 text-sm font-bold uppercase tracking-widest transition-all relative ${
            activeTab === 'reviews' 
              ? 'text-primary border-b-2 border-primary' 
              : 'text-base-content/40 hover:text-base-content'
          }`}
        >
          <div className="flex items-center gap-2">
            <MessageSquare size={16} />
            Reviews
          </div>
        </button>
        <button
          onClick={() => setActiveTab('destinations')}
          className={`pb-3 px-4 text-sm font-bold uppercase tracking-widest transition-all relative ${
            activeTab === 'destinations' 
              ? 'text-primary border-b-2 border-primary' 
              : 'text-base-content/40 hover:text-base-content'
          }`}
        >
          <div className="flex items-center gap-2">
            <MapPin size={16} />
            Destinations
          </div>
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'reviews' && <ReviewsTab />}
      {activeTab === 'destinations' && <DestinationsTab />}
    </div>
  );
};

export default ModerationSection;
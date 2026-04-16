import { useState, useEffect } from 'react';
import api from '../../lib/api';
import toast from 'react-hot-toast';
import AdminDataTable from './AdminDataTable';
import AdminModal from './AdminModal';
import Button from '../Button';
import { Flag, Eye, Check, X, RefreshCw, Filter } from 'lucide-react';

const STATUS_OPTIONS = ['pending', 'under_review', 'resolved', 'dismissed'];

const STATUS_BADGE = {
  pending:      'bg-amber-100 text-amber-700',
  under_review: 'bg-sky-100 text-sky-700',
  resolved:     'bg-green-100 text-green-700',
  dismissed:    'bg-base-200 text-base-content/50',
};

const AdminReportsSection = () => {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [selectedReport, setSelectedReport] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [resolution, setResolution] = useState('');
  const [newStatus, setNewStatus] = useState('resolved');
  const [saving, setSaving] = useState(false);
  const limit = 25;

  useEffect(() => {
    fetchReports();
  }, [page, statusFilter]);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/reports', { params: { status: statusFilter, limit, offset: (page - 1) * limit } });
      if (res.data?.success) {
        setReports(res.data.data.reports);
        setTotal(res.data.data.total);
      }
    } catch {
      toast.error('Failed to load reports');
    } finally {
      setLoading(false);
    }
  };

  const openModal = (report) => {
    setSelectedReport(report);
    setResolution('');
    setNewStatus('resolved');
    setShowModal(true);
  };

  const handleUpdate = async () => {
    if (!selectedReport) return;
    setSaving(true);
    try {
      await api.patch(`/admin/reports/${selectedReport.id}`, { status: newStatus, resolution_note: resolution });
      toast.success('Report updated');
      setShowModal(false);
      fetchReports();
    } catch {
      toast.error('Failed to update report');
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    {
      key: 'id',
      label: '#',
      render: (_, row) => <span className="text-xs font-mono text-base-content/50">#{row.id}</span>
    },
    {
      key: 'reported_entity_type',
      label: 'Type',
      render: (v) => <span className="text-xs font-bold capitalize">{v}</span>
    },
    {
      key: 'entity_id',
      label: 'Entity',
      render: (v) => <span className="text-xs font-mono">{v}</span>
    },
    {
      key: 'reason',
      label: 'Reason',
      render: (v) => <span className="text-xs capitalize">{String(v).replace(/_/g, ' ')}</span>
    },
    {
      key: 'reporter_email',
      label: 'Reporter',
      render: (v) => <span className="text-xs text-base-content/60">{v || '—'}</span>
    },
    {
      key: 'status',
      label: 'Status',
      render: (v) => (
        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase ${STATUS_BADGE[v] || 'bg-base-200'}`}>
          {v}
        </span>
      )
    },
    {
      key: 'created_at',
      label: 'Submitted',
      render: (v) => <span className="text-xs text-base-content/50">{v ? new Date(v).toLocaleDateString() : '—'}</span>
    },
    {
      key: 'actions',
      label: '',
      render: (_, row) => (
        <button
          type="button"
          onClick={() => openModal(row)}
          className="p-1.5 rounded-lg text-base-content/40 hover:text-primary hover:bg-primary/10 transition-colors"
          aria-label={`Review report #${row.id}`}
        >
          <Eye size={14} />
        </button>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-black text-base-content flex items-center gap-2">
            <Flag size={20} className="text-error" aria-hidden="true" />
            Content Reports
          </h2>
          <p className="text-sm text-base-content/50 mt-0.5">{total} report{total !== 1 ? 's' : ''} total</p>
        </div>
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-base-content/40" aria-hidden="true" />
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="text-sm bg-base-200 border border-base-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary/30"
            aria-label="Filter by status"
          >
            <option value="all">All statuses</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={fetchReports}
            className="p-2 rounded-lg text-base-content/40 hover:text-primary hover:bg-primary/10 transition-colors"
            aria-label="Refresh reports"
          >
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      <AdminDataTable
        columns={columns}
        data={reports}
        loading={loading}
        total={total}
        page={page}
        limit={limit}
        onPageChange={setPage}
        emptyMessage="No reports found"
      />

      {showModal && selectedReport && (
        <AdminModal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          title={`Report #${selectedReport.id}`}
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="font-semibold text-base-content/60">Type: </span>{selectedReport.reported_entity_type}</div>
              <div><span className="font-semibold text-base-content/60">Entity ID: </span>{selectedReport.entity_id}</div>
              <div><span className="font-semibold text-base-content/60">Reason: </span>{String(selectedReport.reason).replace(/_/g, ' ')}</div>
              <div><span className="font-semibold text-base-content/60">Reporter: </span>{selectedReport.reporter_email || 'Anonymous'}</div>
            </div>

            {selectedReport.details && (
              <div>
                <p className="text-xs font-semibold text-base-content/50 mb-1">Details</p>
                <p className="text-sm bg-base-200 rounded-lg p-3 text-base-content/80">{selectedReport.details}</p>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-base-content/60 mb-1.5" htmlFor="report-new-status">
                Update status
              </label>
              <select
                id="report-new-status"
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value)}
                className="w-full text-sm bg-base-200 border border-base-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                {STATUS_OPTIONS.filter((s) => s !== 'pending').map((s) => (
                  <option key={s} value={s}>{s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-base-content/60 mb-1.5" htmlFor="report-resolution">
                Resolution note (optional)
              </label>
              <textarea
                id="report-resolution"
                value={resolution}
                onChange={(e) => setResolution(e.target.value)}
                rows={3}
                className="w-full text-sm bg-base-200 border border-base-300 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="Describe the action taken…"
              />
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => setShowModal(false)}>Cancel</Button>
              <Button variant="primary" onClick={handleUpdate} loading={saving}>
                <Check size={14} aria-hidden="true" /> Update Report
              </Button>
            </div>
          </div>
        </AdminModal>
      )}
    </div>
  );
};

export default AdminReportsSection;

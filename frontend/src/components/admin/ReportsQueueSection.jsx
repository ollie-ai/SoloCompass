import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../lib/api';

const STATUSES = ['open', 'under_review', 'actioned', 'dismissed'];

export default function ReportsQueueSection() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/reports?status=open&limit=100');
      setReports(res.data?.data?.reports || []);
    } catch {
      toast.error('Failed to load reports queue');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const updateStatus = async (id, status) => {
    try {
      await api.patch(`/admin/reports/${id}`, { status });
      setReports(prev => prev.map(r => (r.id === id ? { ...r, status } : r)));
    } catch {
      toast.error('Failed to update report status');
    }
  };

  return (
    <section className="rounded-2xl border border-base-300 bg-base-100 p-6">
      <h2 className="text-2xl font-black mb-4">Reports Queue</h2>
      {loading ? (
        <p className="text-sm text-base-content/60">Loading...</p>
      ) : reports.length === 0 ? (
        <p className="text-sm text-base-content/60">No open reports.</p>
      ) : (
        <div className="space-y-3">
          {reports.map(report => (
            <div key={report.id} className="border border-base-300 rounded-xl p-4">
              <p className="text-sm font-bold">{report.reported_entity_type} · {report.entity_id}</p>
              <p className="text-sm text-base-content/70 mt-1">{report.reason}</p>
              {report.details && <p className="text-xs text-base-content/50 mt-1">{report.details}</p>}
              <div className="flex flex-wrap gap-2 mt-3">
                {STATUSES.map(status => (
                  <button
                    key={status}
                    onClick={() => updateStatus(report.id, status)}
                    className={`text-xs px-2 py-1 rounded ${report.status === status ? 'bg-brand-vibrant text-white' : 'border border-base-300'}`}
                  >
                    {status}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

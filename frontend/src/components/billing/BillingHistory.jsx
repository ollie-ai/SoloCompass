import { useState, useEffect } from 'react';
import { Download, ExternalLink, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import api from '../../lib/api';

const STATUS_CONFIG = {
  paid: { icon: CheckCircle, className: 'text-brand-vibrant', label: 'Paid' },
  open: { icon: Clock, className: 'text-warning', label: 'Open' },
  void: { icon: AlertCircle, className: 'text-base-content/40', label: 'Void' },
  uncollectible: { icon: AlertCircle, className: 'text-error', label: 'Failed' },
};

export function BillingHistory() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.get('/billing/invoices')
      .then(res => setInvoices(res.data.data || []))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map(i => <div key={i} className="h-14 bg-base-200 rounded-xl animate-pulse" />)}
      </div>
    );
  }

  if (error) return <p className="text-sm text-error font-medium">{error}</p>;
  if (!invoices.length) return <p className="text-sm text-base-content/50 font-medium py-4 text-center">No invoices yet.</p>;

  return (
    <div className="space-y-2">
      {invoices.map(inv => {
        const config = STATUS_CONFIG[inv.status] || STATUS_CONFIG.open;
        const Icon = config.icon;
        return (
          <div key={inv.id} className="flex items-center justify-between p-3 rounded-xl bg-base-200/50 border border-base-300/50 hover:bg-base-200 transition-colors">
            <div className="flex items-center gap-3 min-w-0">
              <Icon size={16} className={config.className} />
              <div className="min-w-0">
                <p className="text-sm font-bold text-base-content truncate">{inv.description || `${inv.currency} Invoice`}</p>
                <p className="text-[10px] text-base-content/50 font-medium">
                  {new Date(inv.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="text-sm font-black text-base-content">
                {inv.currency === 'GBP' ? '£' : inv.currency === 'USD' ? '$' : `${inv.currency} `}
                {inv.amount.toFixed(2)}
              </span>
              <div className="flex gap-1">
                {inv.pdfUrl && (
                  <a href={inv.pdfUrl} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-lg hover:bg-base-300 text-base-content/40 transition-colors" title="Download PDF">
                    <Download size={13} />
                  </a>
                )}
                {inv.hostedUrl && (
                  <a href={inv.hostedUrl} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-lg hover:bg-base-300 text-base-content/40 transition-colors" title="View invoice">
                    <ExternalLink size={13} />
                  </a>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default BillingHistory;

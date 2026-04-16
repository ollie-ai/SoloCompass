import { useState, useEffect } from 'react';
import { CreditCard, Download, ExternalLink, Calendar, AlertCircle } from 'lucide-react';
import api from '../lib/api';
import Skeleton from './Skeleton';

const formatAmount = (amount, currency) => {
  const divisor = currency?.toLowerCase() === 'jpy' ? 1 : 100;
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: (currency || 'GBP').toUpperCase(),
    minimumFractionDigits: 2,
  }).format(amount / divisor);
};

const formatDate = (ts) =>
  ts ? new Date(ts * 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

/**
 * BillingHistory — shows a list of paid Stripe invoices with download links.
 *
 * Props:
 *   className – extra classes for the outer container
 */
export default function BillingHistory({ className = '' }) {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchInvoices = async () => {
      try {
        const res = await api.get('/billing/invoices');
        setInvoices(res.data?.data?.invoices || []);
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to load billing history.');
      } finally {
        setLoading(false);
      }
    };
    fetchInvoices();
  }, []);

  return (
    <div className={`bg-base-100 rounded-2xl border border-base-300/50 shadow-sm overflow-hidden ${className}`}>
      <div className="px-6 py-4 border-b border-base-200/60 flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center" aria-hidden="true">
          <CreditCard size={18} />
        </div>
        <div>
          <h3 className="text-sm font-black text-base-content">Billing History</h3>
          <p className="text-xs text-base-content/50">Your paid invoices</p>
        </div>
      </div>

      <div className="p-4">
        {loading && (
          <div className="space-y-3" aria-busy="true" aria-label="Loading billing history">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        )}

        {!loading && error && (
          <div className="flex items-center gap-2 text-sm text-error py-4 px-3 bg-error/5 rounded-xl" role="alert">
            <AlertCircle size={16} aria-hidden="true" />
            {error}
          </div>
        )}

        {!loading && !error && invoices.length === 0 && (
          <div className="text-center py-8">
            <div className="w-12 h-12 rounded-xl bg-base-200 flex items-center justify-center mx-auto mb-3 text-base-content/30" aria-hidden="true">
              <CreditCard size={22} />
            </div>
            <p className="text-sm font-semibold text-base-content/70">No invoices yet</p>
            <p className="text-xs text-base-content/40 mt-1">Your billing history will appear here once you subscribe.</p>
          </div>
        )}

        {!loading && !error && invoices.length > 0 && (
          <ul className="divide-y divide-base-200/60" role="list" aria-label="Invoice list">
            {invoices.map((inv) => (
              <li key={inv.id} className="flex items-center gap-4 py-3 first:pt-0 last:pb-0">
                <div className="w-8 h-8 rounded-lg bg-base-200 flex items-center justify-center shrink-0 text-base-content/40" aria-hidden="true">
                  <Calendar size={14} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-base-content truncate">
                    {inv.number || 'Invoice'}
                  </p>
                  <p className="text-xs text-base-content/50">
                    {formatDate(inv.periodStart)} – {formatDate(inv.periodEnd)}
                  </p>
                </div>
                <div className="text-sm font-black text-base-content shrink-0">
                  {formatAmount(inv.amount, inv.currency)}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {inv.pdfUrl && (
                    <a
                      href={inv.pdfUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 rounded-lg text-base-content/40 hover:text-primary hover:bg-primary/10 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30"
                      aria-label={`Download invoice ${inv.number || inv.id}`}
                    >
                      <Download size={14} />
                    </a>
                  )}
                  {inv.hostedUrl && (
                    <a
                      href={inv.hostedUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 rounded-lg text-base-content/40 hover:text-primary hover:bg-primary/10 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30"
                      aria-label={`View invoice ${inv.number || inv.id} online`}
                    >
                      <ExternalLink size={14} />
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

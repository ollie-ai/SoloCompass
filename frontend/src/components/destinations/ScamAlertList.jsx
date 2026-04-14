import { useState, useEffect } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import destinationService from '../../lib/destinationService';

const SEVERITY_COLORS = {
  high: 'border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800',
  medium: 'border-yellow-200 bg-yellow-50 dark:bg-yellow-900/20 dark:border-yellow-800',
  low: 'border-blue-200 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-800',
};

const SEVERITY_BADGE = {
  high: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  medium: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
  low: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
};

function ScamAlertList({ destinationId }) {
  const [scams, setScams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    if (!destinationId) return;
    destinationService.getScams(destinationId)
      .then(res => setScams(res.data?.data || []))
      .catch(() => setScams([]))
      .finally(() => setLoading(false));
  }, [destinationId]);

  if (loading) return <div className="animate-pulse h-32 bg-gray-100 dark:bg-gray-800 rounded-xl" />;
  if (!scams.length) return (
    <div className="text-center py-6 text-gray-500 text-sm">
      <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-30" />
      <p>No known scams reported for this destination.</p>
    </div>
  );

  return (
    <div className="space-y-2">
      <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-yellow-500" />
        Common Scams & Watch-outs
      </h3>
      {scams.map((scam, i) => {
        const severity = scam.severity || 'medium';
        const isOpen = expanded === i;
        return (
          <div key={scam.id || i} className={`rounded-xl border p-3 ${SEVERITY_COLORS[severity] || SEVERITY_COLORS.medium}`}>
            <button
              className="w-full flex items-start justify-between gap-2 text-left"
              onClick={() => setExpanded(isOpen ? null : i)}
            >
              <div className="flex items-start gap-2">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize shrink-0 mt-0.5 ${SEVERITY_BADGE[severity] || SEVERITY_BADGE.medium}`}>
                  {severity}
                </span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">{scam.title}</span>
              </div>
              {scam.description && (isOpen ? <ChevronUp className="w-4 h-4 shrink-0 text-gray-500" /> : <ChevronDown className="w-4 h-4 shrink-0 text-gray-500" />)}
            </button>
            {isOpen && scam.description && (
              <p className="mt-2 text-sm text-gray-700 dark:text-gray-300 pl-2">{scam.description}</p>
            )}
            {scam.area && (
              <p className="mt-1 text-xs text-gray-500">📍 {scam.area}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default ScamAlertList;

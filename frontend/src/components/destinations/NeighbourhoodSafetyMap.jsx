import { useState, useEffect } from 'react';
import { MapPin, Shield } from 'lucide-react';
import destinationService from '../../lib/destinationService';

const RISK_COLORS = {
  low: 'bg-green-500',
  medium: 'bg-yellow-500',
  high: 'bg-orange-500',
  very_high: 'bg-red-500',
};

const RISK_LABELS = {
  low: 'Low Risk',
  medium: 'Moderate',
  high: 'High Risk',
  very_high: 'Avoid',
};

function NeighbourhoodSafetyMap({ destinationId, lat, lng }) {
  const [areas, setAreas] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!destinationId) return;
    destinationService.getSafetyAreas(destinationId)
      .then(res => setAreas(res.data?.data || []))
      .catch(() => setAreas([]))
      .finally(() => setLoading(false));
  }, [destinationId]);

  if (loading) return <div className="animate-pulse h-48 bg-gray-100 dark:bg-gray-800 rounded-xl" />;

  if (!areas.length) return (
    <div className="text-center py-6 text-gray-500 text-sm">
      <Shield className="w-8 h-8 mx-auto mb-2 opacity-30" />
      <p>No neighbourhood safety data available for this destination.</p>
    </div>
  );

  return (
    <div className="space-y-3">
      <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
        <MapPin className="w-4 h-4 text-indigo-500" />
        Neighbourhood Safety
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {areas.map(area => {
          const risk = area.risk_level || 'medium';
          return (
            <div
              key={area.id}
              className="flex items-start gap-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-3"
            >
              <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${RISK_COLORS[risk] || RISK_COLORS.medium}`} />
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900 dark:text-white">{area.area_name}</span>
                  <span className="text-xs text-gray-500">{RISK_LABELS[risk] || risk}</span>
                </div>
                {area.notes && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{area.notes}</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default NeighbourhoodSafetyMap;

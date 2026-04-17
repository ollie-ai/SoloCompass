import { useState } from 'react';
import { X, Plus, Scale } from 'lucide-react';
import destinationService from '../../lib/destinationService';
import SoloScoreBadge from './SoloScoreBadge';
import SafetyScoreBar from './SafetyScoreBar';

function DestinationCompare({ onClose }) {
  const [ids, setIds] = useState(['', '']);
  const [compareData, setCompareData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleCompare = async () => {
    const validIds = ids.filter(id => id.trim()).map(id => parseInt(id));
    if (validIds.length < 2) {
      setError('Enter at least 2 destination IDs');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await destinationService.compare(validIds);
      setCompareData(res.data?.data || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Comparison failed');
    } finally {
      setLoading(false);
    }
  };

  const COMPARE_FIELDS = [
    { label: 'Budget Level', key: 'budget_level' },
    { label: 'Climate', key: 'climate' },
    { label: 'Safety Rating', key: 'safety_rating' },
    { label: 'Visa', key: 'visa_notes' },
    { label: 'Currency', key: 'currency_code' },
    { label: 'Language', key: 'language' },
  ];

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Scale className="w-5 h-5 text-indigo-600" />
          Compare Destinations
        </h2>
        {onClose && <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"><X className="w-5 h-5" /></button>}
      </div>

      <div className="flex gap-2 mb-4">
        {ids.map((id, i) => (
          <input
            key={i}
            type="number"
            value={id}
            onChange={e => {
              const newIds = [...ids];
              newIds[i] = e.target.value;
              setIds(newIds);
            }}
            placeholder={`Destination ID ${i + 1}`}
            className="flex-1 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300"
          />
        ))}
        {ids.length < 3 && (
          <button onClick={() => setIds([...ids, ''])} className="px-3 py-2 border border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-indigo-400 transition-colors">
            <Plus className="w-4 h-4" />
          </button>
        )}
        <button
          onClick={handleCompare}
          disabled={loading}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Comparing...' : 'Compare'}
        </button>
      </div>

      {error && <p className="text-sm text-red-500 mb-4">{error}</p>}

      {compareData && compareData.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="text-left py-2 pr-4 text-gray-500 font-medium w-32">Feature</th>
                {compareData.map(dest => (
                  <th key={dest.id} className="text-left py-2 px-2 font-semibold text-gray-900 dark:text-white">
                    <div>{dest.name}</div>
                    <div className="text-xs text-gray-500 font-normal">{dest.country}</div>
                    <SoloScoreBadge score={dest.solo_friendly_rating} size="sm" className="mt-1" />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {COMPARE_FIELDS.map(field => (
                <tr key={field.key}>
                  <td className="py-2 pr-4 text-gray-500">{field.label}</td>
                  {compareData.map(dest => (
                    <td key={dest.id} className="py-2 px-2 text-gray-700 dark:text-gray-300 capitalize">
                      {dest[field.key] || '—'}
                    </td>
                  ))}
                </tr>
              ))}
              <tr>
                <td className="py-2 pr-4 text-gray-500">Safety Scores</td>
                {compareData.map(dest => (
                  <td key={dest.id} className="py-2 px-2">
                    {dest.safety_overall ? (
                      <div className="space-y-1 min-w-[120px]">
                        <SafetyScoreBar label="Overall" score={dest.safety_overall} />
                        <SafetyScoreBar label="Solo" score={dest.safety_solo} />
                        <SafetyScoreBar label="Women" score={dest.safety_women} />
                      </div>
                    ) : <span className="text-gray-400">—</span>}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default DestinationCompare;

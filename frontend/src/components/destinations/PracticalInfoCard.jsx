import { useState, useEffect } from 'react';
import { Wifi, Zap, Droplets, Globe, Phone, CreditCard, Car } from 'lucide-react';
import destinationService from '../../lib/destinationService';

function PracticalInfoCard({ destinationId, initialData = null }) {
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(!initialData);

  useEffect(() => {
    if (!initialData && destinationId) {
      destinationService.getPractical(destinationId)
        .then(res => setData(res.data?.data || {}))
        .catch(() => setData({}))
        .finally(() => setLoading(false));
    }
  }, [destinationId, initialData]);

  if (loading) return <div className="animate-pulse h-32 bg-gray-100 dark:bg-gray-800 rounded-xl" />;
  if (!data) return null;

  const items = [
    { icon: Globe, label: 'Visa', value: data.visa_notes || (data.visa_on_arrival ? 'Visa on arrival available' : 'Check requirements') },
    { icon: Phone, label: 'Emergency', value: data.emergency_number || data.police_number || '112' },
    { icon: Zap, label: 'Power', value: data.power_socket ? `${data.power_socket}${data.voltage ? ` · ${data.voltage}V` : ''}` : 'Standard EU/UK/US' },
    { icon: Droplets, label: 'Water', value: data.tap_water_safe ? 'Tap water safe' : 'Use bottled water' },
    { icon: Wifi, label: 'Internet', value: data.internet_quality || 'Varies by area' },
    { icon: CreditCard, label: 'Currency', value: data.currency_code ? `${data.currency_code}${data.card_acceptance ? ` · ${data.card_acceptance}` : ''}` : 'Check locally' },
    { icon: Car, label: 'Driving', value: data.driving_side ? `Drive on the ${data.driving_side}` : null },
  ].filter(item => item.value);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
      <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Practical Info</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {items.map(({ icon: Icon, label, value }) => (
          <div key={label} className="flex items-start gap-3">
            <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-900/30">
              <Icon className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
              <p className="text-sm text-gray-800 dark:text-gray-200">{value}</p>
            </div>
          </div>
        ))}
      </div>
      {data.tipping_culture && (
        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400">Tipping</p>
          <p className="text-sm text-gray-700 dark:text-gray-300">{data.tipping_culture}</p>
        </div>
      )}
    </div>
  );
}

export default PracticalInfoCard;

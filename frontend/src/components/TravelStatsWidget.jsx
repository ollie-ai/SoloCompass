import { useEffect, useState } from 'react';
import { Globe, Map, Activity, MapPin } from 'lucide-react';
import api from '../lib/api';

export default function TravelStatsWidget() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/users/me/stats').then(res => {
      setStats(res.data.data);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="card bg-base-100 shadow-sm p-6"><div className="loading loading-spinner" /></div>;

  const items = [
    { label: 'Trips', value: stats?.trips_total ?? 0, icon: Map },
    { label: 'Countries', value: stats?.countries_visited ?? 0, icon: Globe },
    { label: 'Activities', value: stats?.activities_completed ?? 0, icon: Activity },
    { label: 'Check-ins', value: stats?.check_ins ?? 0, icon: MapPin },
  ];

  return (
    <div className="card bg-base-100 shadow-sm">
      <div className="card-body">
        <h2 className="card-title text-lg">Travel Stats</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-2">
          {items.map(({ label, value, icon: Icon }) => (
            <div key={label} className="text-center p-3 rounded-lg bg-base-200">
              <Icon className="w-5 h-5 mx-auto mb-1 text-brand-vibrant" />
              <div className="text-2xl font-bold">{value}</div>
              <div className="text-xs text-base-content/60">{label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

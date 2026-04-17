import { useState, useEffect } from 'react';
import { Cloud, Droplets, Thermometer } from 'lucide-react';
import destinationService from '../lib/destinationService';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function WeatherChart({ destinationId, className = '' }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!destinationId) return;
    setLoading(true);
    destinationService.getWeather(destinationId)
      .then(res => {
        setData(res.data?.data || null);
        setError(null);
      })
      .catch(err => setError('Weather data unavailable'))
      .finally(() => setLoading(false));
  }, [destinationId]);

  if (loading) return <div className={`animate-pulse h-48 bg-gray-100 dark:bg-gray-800 rounded-xl ${className}`} />;
  if (error) return <div className={`text-sm text-gray-500 p-4 text-center ${className}`}>{error}</div>;

  const monthly = data?.monthly || [];
  const forecast = data?.forecast || [];
  const current = data?.current;

  const maxTemp = monthly.length
    ? Math.max(...monthly.map(m => m.temp_high || 0))
    : 40;

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <Cloud className="w-4 h-4 text-blue-500" />
          Weather
        </h3>
        {current && (
          <div className="text-right">
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{Math.round(current.temp)}°C</p>
            <p className="text-xs text-gray-500">{current.description}</p>
          </div>
        )}
      </div>

      {monthly.length === 12 ? (
        <div className="overflow-x-auto">
          <div className="min-w-[600px]">
            <div className="flex items-end gap-1 h-32 mb-1">
              {monthly.map((m, i) => {
                const high = m.temp_high || 0;
                const low = m.temp_low || 0;
                const heightPct = maxTemp > 0 ? (high / maxTemp) * 100 : 50;
                const lowPct = maxTemp > 0 ? (low / maxTemp) * 100 : 20;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                    <div
                      className="w-full bg-orange-400 dark:bg-orange-500 rounded-sm relative"
                      style={{ height: `${heightPct}%` }}
                      title={`High: ${high}°C`}
                    >
                      <div
                        className="absolute bottom-0 left-0 right-0 bg-blue-400 dark:bg-blue-500 rounded-sm opacity-70"
                        style={{ height: `${lowPct}%` }}
                        title={`Low: ${low}°C`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex gap-1">
              {MONTHS.map((m, i) => (
                <div key={i} className="flex-1 text-center text-xs text-gray-500">{m}</div>
              ))}
            </div>
            <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
              <span className="flex items-center gap-1"><span className="w-3 h-2 bg-orange-400 rounded-sm inline-block" /> High temp</span>
              <span className="flex items-center gap-1"><span className="w-3 h-2 bg-blue-400 rounded-sm inline-block" /> Low temp</span>
            </div>
            {monthly.some(m => m.rainfall != null) && (
              <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                <div className="flex items-center gap-1 mb-1">
                  <Droplets className="w-3 h-3 text-blue-500" />
                  <span className="text-xs text-gray-500">Rainfall (mm)</span>
                </div>
                <div className="flex items-end gap-1 h-12">
                  {monthly.map((m, i) => {
                    const maxRain = Math.max(...monthly.map(x => x.rainfall || 0)) || 1;
                    const pct = ((m.rainfall || 0) / maxRain) * 100;
                    return (
                      <div key={i} className="flex-1 bg-blue-200 dark:bg-blue-700 rounded-sm" style={{ height: `${pct}%` }} title={`${m.rainfall}mm`} />
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : forecast.length > 0 ? (
        <div>
          <p className="text-xs text-gray-500 mb-2">5-day forecast (12-month data not available)</p>
          <div className="grid grid-cols-5 gap-2">
            {forecast.slice(0, 5).map((day, i) => (
              <div key={i} className="text-center">
                <p className="text-xs text-gray-500">{day.date ? new Date(day.date).toLocaleDateString('en', { weekday: 'short' }) : `Day ${i + 1}`}</p>
                <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{Math.round(day.maxTemp || 0)}°</p>
                <p className="text-xs text-gray-400">{Math.round(day.minTemp || 0)}°</p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-sm text-gray-500 text-center py-4">No weather data available</p>
      )}
    </div>
  );
}

export default WeatherChart;

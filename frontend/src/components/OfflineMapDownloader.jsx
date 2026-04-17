import { useState, useCallback } from 'react';
import { Download, CheckCircle, AlertCircle, Wifi, WifiOff, Loader2, X } from 'lucide-react';

const TILE_TEMPLATE = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const SUBDOMAINS = ['a', 'b', 'c'];

/**
 * Build an array of OSM tile URLs that cover the given bounding box
 * at zoom levels from zoomMin to zoomMax (inclusive).
 */
function buildTileUrls(bounds, zoomMin, zoomMax) {
  const urls = [];

  const lng2tile = (lng, z) => Math.floor(((lng + 180) / 360) * Math.pow(2, z));
  const lat2tile = (lat, z) => Math.floor(
    ((1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) / 2) *
      Math.pow(2, z)
  );

  for (let z = zoomMin; z <= zoomMax; z++) {
    const xMin = lng2tile(bounds.west, z);
    const xMax = lng2tile(bounds.east, z);
    const yMin = lat2tile(bounds.north, z);
    const yMax = lat2tile(bounds.south, z);

    for (let x = xMin; x <= xMax; x++) {
      for (let y = yMin; y <= yMax; y++) {
        const s = SUBDOMAINS[(x + y) % SUBDOMAINS.length];
        urls.push(TILE_TEMPLATE.replace('{s}', s).replace('{z}', z).replace('{x}', x).replace('{y}', y));
      }
    }
  }

  return urls;
}

/**
 * OfflineMapDownloader — downloads and caches OpenStreetMap tiles for offline use.
 *
 * Uses the Cache API (available in PWA/service-worker contexts) to store
 * tile images so they can be served offline.
 *
 * Props:
 *   bounds   – { north, south, east, west } decimal degrees
 *   label    – Human-readable area name shown in the UI
 *   zoomMin  – Minimum zoom level to cache (default 8)
 *   zoomMax  – Maximum zoom level to cache (default 14)
 *   cacheName – Cache API bucket name (default 'solocompass-map-tiles')
 *   className – Extra classes for the outer container
 */
export default function OfflineMapDownloader({
  bounds,
  label = 'Current Area',
  zoomMin = 8,
  zoomMax = 14,
  cacheName = 'solocompass-map-tiles',
  className = '',
}) {
  const [status, setStatus] = useState('idle'); // idle | downloading | done | error | unsupported
  const [progress, setProgress] = useState({ done: 0, total: 0 });

  const isSupported = typeof window !== 'undefined' && 'caches' in window;

  const handleDownload = useCallback(async () => {
    if (!isSupported) {
      setStatus('unsupported');
      return;
    }

    if (!bounds) return;

    const urls = buildTileUrls(bounds, zoomMin, zoomMax);
    if (urls.length === 0) return;

    setStatus('downloading');
    setProgress({ done: 0, total: urls.length });

    try {
      const cache = await window.caches.open(cacheName);
      let completed = 0;

      // Download in batches of 10 to avoid overwhelming the network
      const batchSize = 10;
      for (let i = 0; i < urls.length; i += batchSize) {
        const batch = urls.slice(i, i + batchSize);
        await Promise.all(
          batch.map(async (url) => {
            try {
              const cached = await cache.match(url);
              if (!cached) {
                const response = await fetch(url);
                if (response.ok) {
                  await cache.put(url, response.clone());
                }
              }
            } catch {
              // Silently skip individual tile failures
            }
            completed += 1;
            setProgress({ done: completed, total: urls.length });
          })
        );
      }

      setStatus('done');
    } catch (err) {
      console.error('[OfflineMapDownloader] Download failed:', err);
      setStatus('error');
    }
  }, [bounds, zoomMin, zoomMax, cacheName, isSupported]);

  const handleClear = useCallback(async () => {
    try {
      await window.caches.delete(cacheName);
      setStatus('idle');
      setProgress({ done: 0, total: 0 });
    } catch (err) {
      console.error('[OfflineMapDownloader] Failed to clear cache:', err);
    }
  }, [cacheName]);

  const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  if (!isSupported) {
    return (
      <div className={`flex items-center gap-2 text-sm text-base-content/50 ${className}`}>
        <WifiOff size={14} />
        <span>Offline maps not supported in this browser</span>
      </div>
    );
  }

  return (
    <div className={`glass-card p-4 rounded-2xl border border-base-300/50 space-y-3 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {status === 'done' ? (
            <Wifi size={16} className="text-success" />
          ) : (
            <WifiOff size={16} className="text-base-content/40" />
          )}
          <div>
            <p className="text-sm font-black text-base-content">{label}</p>
            <p className="text-[11px] font-bold text-base-content/40 uppercase tracking-widest">
              Offline Map Tiles
            </p>
          </div>
        </div>

        {status === 'done' && (
          <button
            onClick={handleClear}
            className="flex items-center gap-1 text-[11px] font-black text-error/70 hover:text-error transition-colors"
            title="Remove cached tiles"
          >
            <X size={12} />
            Clear
          </button>
        )}
      </div>

      {status === 'downloading' && (
        <div className="space-y-1.5">
          <div className="w-full bg-base-200 rounded-full h-1.5">
            <div
              className="bg-brand-vibrant h-1.5 rounded-full transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="text-[11px] font-bold text-base-content/50">
            {progress.done.toLocaleString()} / {progress.total.toLocaleString()} tiles ({pct}%)
          </p>
        </div>
      )}

      {status === 'done' && (
        <div className="flex items-center gap-1.5 text-xs font-bold text-success">
          <CheckCircle size={14} />
          {progress.done.toLocaleString()} tiles cached — works offline
        </div>
      )}

      {status === 'error' && (
        <div className="flex items-center gap-1.5 text-xs font-bold text-error">
          <AlertCircle size={14} />
          Download failed. Check your connection and try again.
        </div>
      )}

      {(status === 'idle' || status === 'error') && (
        <button
          onClick={handleDownload}
          disabled={!bounds}
          className="w-full flex items-center justify-center gap-2 bg-base-200 hover:bg-base-300 disabled:opacity-40 rounded-xl py-2 text-xs font-black uppercase tracking-tight transition-colors"
        >
          <Download size={13} />
          Download for Offline Use
        </button>
      )}

      {status === 'downloading' && (
        <button
          disabled
          className="w-full flex items-center justify-center gap-2 bg-brand-vibrant/10 rounded-xl py-2 text-xs font-black uppercase tracking-tight text-brand-vibrant"
        >
          <Loader2 size={13} className="animate-spin" />
          Downloading…
        </button>
      )}
    </div>
  );
}

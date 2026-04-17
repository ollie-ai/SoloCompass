import { useState } from 'react';
import { Download, CheckCircle, Loader, MapPin, AlertTriangle } from 'lucide-react';

const TILE_CACHE = 'solocompass-tiles-v1';
const TILE_SERVER = 'https://tile.openstreetmap.org';

function getTileCoords(lat, lng, zoom) {
  const n = Math.pow(2, zoom);
  const x = Math.floor(((lng + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n);
  return { x, y };
}

function getTilesForBounds(bounds, zoom) {
  const { north, south, east, west } = bounds;
  const nw = getTileCoords(north, west, zoom);
  const se = getTileCoords(south, east, zoom);
  const tiles = [];
  for (let x = nw.x; x <= se.x; x++) {
    for (let y = nw.y; y <= se.y; y++) {
      tiles.push({ x, y, z: zoom });
    }
  }
  return tiles;
}

function estimateTileCount(bounds, minZoom, maxZoom) {
  let count = 0;
  for (let z = minZoom; z <= maxZoom; z++) {
    count += getTilesForBounds(bounds, z).length;
  }
  return count;
}

/**
 * OfflineMapDownloader — downloads OSM map tiles for a bounds area into Cache API.
 *
 * Props:
 *   bounds: { north, south, east, west }
 *   minZoom: number (default 10)
 *   maxZoom: number (default 14)
 *   label: string (default 'Download Area')
 */
export default function OfflineMapDownloader({ bounds, minZoom = 10, maxZoom = 14, label = 'Download Area' }) {
  const [state, setState] = useState('idle'); // idle | downloading | done | error
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [errorMsg, setErrorMsg] = useState('');

  const supported = typeof window !== 'undefined' && 'caches' in window;

  if (!supported) return null;

  const estimatedTiles = bounds ? estimateTileCount(bounds, minZoom, maxZoom) : 0;
  const estimatedMB = (estimatedTiles * 8 / 1024).toFixed(1); // ~8KB per tile avg

  const handleDownload = async () => {
    if (!bounds) return;
    setState('downloading');
    setErrorMsg('');

    try {
      const cache = await caches.open(TILE_CACHE);
      const allTiles = [];
      for (let z = minZoom; z <= maxZoom; z++) {
        allTiles.push(...getTilesForBounds(bounds, z));
      }

      setProgress({ done: 0, total: allTiles.length });

      const BATCH = 6;
      for (let i = 0; i < allTiles.length; i += BATCH) {
        const batch = allTiles.slice(i, i + BATCH);
        await Promise.all(
          batch.map(async ({ x, y, z }) => {
            const url = `${TILE_SERVER}/${z}/${x}/${y}.png`;
            try {
              const cached = await cache.match(url);
              if (!cached) {
                const res = await fetch(url);
                if (res.ok) await cache.put(url, res);
              }
            } catch {
              // Skip individual tile failures silently
            }
          })
        );
        setProgress(p => ({ ...p, done: Math.min(p.total, i + BATCH) }));
      }

      setState('done');
    } catch (err) {
      setErrorMsg(err.message || 'Download failed');
      setState('error');
    }
  };

  const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <div className="card bg-base-100 border border-base-200 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <MapPin size={15} className="text-brand-vibrant" />
        <span className="text-sm font-semibold text-base-content">{label}</span>
      </div>

      {bounds && (
        <p className="text-xs text-base-content/50">
          ~{estimatedTiles} tiles · est. {estimatedMB} MB
        </p>
      )}

      {state === 'idle' && (
        <button
          onClick={handleDownload}
          disabled={!bounds}
          className="btn btn-sm btn-primary gap-2 w-full"
        >
          <Download size={14} />
          Download for offline use
        </button>
      )}

      {state === 'downloading' && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-base-content/70">
            <Loader size={13} className="animate-spin" />
            Downloading… {pct}%
          </div>
          <div className="w-full bg-base-200 rounded-full h-1.5">
            <div
              className="h-1.5 rounded-full bg-brand-vibrant transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="text-xs text-base-content/40">{progress.done} / {progress.total} tiles</p>
        </div>
      )}

      {state === 'done' && (
        <div className="flex items-center gap-2 text-sm text-emerald-600">
          <CheckCircle size={15} />
          Maps saved for offline use
        </div>
      )}

      {state === 'error' && (
        <div className="flex items-start gap-2 text-sm text-error">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <span>{errorMsg || 'Download failed. Please try again.'}</span>
        </div>
      )}
    </div>
  );
}

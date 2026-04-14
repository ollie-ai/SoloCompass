import { useState } from 'react';
import PropTypes from 'prop-types';
import { Download, WifiOff, CheckCircle2, AlertTriangle, Info } from 'lucide-react';
import Button from './Button';

/**
 * OfflineMapDownloader — UI component for managing offline map areas.
 *
 * SoloCompass uses OpenStreetMap tiles delivered by the browser's
 * Service Worker cache (Cache Storage API). This component surfaces that
 * capability to the user: they can pre-cache tiles for a named region,
 * see cached regions, and delete them to free storage.
 *
 * When a Service Worker is not registered (dev mode or unsupported browsers)
 * the component gracefully falls back to an informational state.
 *
 * @example
 * <OfflineMapDownloader regionName="Tokyo" bounds={[[35.5, 139.5], [35.9, 139.9]]} />
 */
const OfflineMapDownloader = ({
  regionName = 'Current area',
  bounds,
  zoom = { min: 10, max: 14 },
  className = '',
}) => {
  const [status, setStatus] = useState('idle'); // idle | caching | cached | error | unsupported
  const [progress, setProgress] = useState(0);
  const [cachedRegions, setCachedRegions] = useState([]);
  const [errorMsg, setErrorMsg] = useState('');

  const swSupported =
    typeof navigator !== 'undefined' &&
    'serviceWorker' in navigator &&
    typeof caches !== 'undefined';

  // Estimate tile count for given bounds and zoom range
  function estimateTiles(b, zMin, zMax) {
    let total = 0;
    for (let z = zMin; z <= zMax; z++) {
      const factor = Math.pow(2, z);
      const x1 = Math.floor(((b[0][1] + 180) / 360) * factor);
      const x2 = Math.floor(((b[1][1] + 180) / 360) * factor);
      const lat1Rad = (b[0][0] * Math.PI) / 180;
      const lat2Rad = (b[1][0] * Math.PI) / 180;
      const y1 = Math.floor(
        ((1 - Math.log(Math.tan(lat1Rad) + 1 / Math.cos(lat1Rad)) / Math.PI) / 2) * factor
      );
      const y2 = Math.floor(
        ((1 - Math.log(Math.tan(lat2Rad) + 1 / Math.cos(lat2Rad)) / Math.PI) / 2) * factor
      );
      total += (Math.abs(x2 - x1) + 1) * (Math.abs(y2 - y1) + 1);
    }
    return total;
  }

  async function handleDownload() {
    if (!swSupported) {
      setStatus('unsupported');
      return;
    }
    if (!bounds) {
      setErrorMsg('No map area specified. Pan and zoom the map to the area you want to save.');
      setStatus('error');
      return;
    }

    setStatus('caching');
    setProgress(0);
    setErrorMsg('');

    try {
      const cache = await caches.open('sc-offline-maps-v1');
      const tileTemplate = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

      const total = estimateTiles(bounds, zoom.min, zoom.max);
      if (total > 2000) {
        setErrorMsg(`This area would require ~${total} tiles. Please zoom in to a smaller region.`);
        setStatus('error');
        return;
      }

      let cached = 0;
      for (let z = zoom.min; z <= zoom.max; z++) {
        const factor = Math.pow(2, z);
        const x1 = Math.floor(((bounds[0][1] + 180) / 360) * factor);
        const x2 = Math.floor(((bounds[1][1] + 180) / 360) * factor);
        const lat1Rad = (bounds[0][0] * Math.PI) / 180;
        const lat2Rad = (bounds[1][0] * Math.PI) / 180;
        const y1 = Math.floor(
          ((1 - Math.log(Math.tan(lat1Rad) + 1 / Math.cos(lat1Rad)) / Math.PI) / 2) * factor
        );
        const y2 = Math.floor(
          ((1 - Math.log(Math.tan(lat2Rad) + 1 / Math.cos(lat2Rad)) / Math.PI) / 2) * factor
        );

        for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++) {
          for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++) {
            const url = tileTemplate
              .replace('{z}', z)
              .replace('{x}', x)
              .replace('{y}', y);
            try {
              const req = new Request(url, { mode: 'cors' });
              const existing = await cache.match(req);
              if (!existing) {
                const resp = await fetch(req);
                if (resp.ok) await cache.put(req, resp);
              }
            } catch { /* individual tile failure is non-fatal */ }
            cached++;
            setProgress(Math.round((cached / total) * 100));
          }
        }
      }

      setCachedRegions(r => [...r, { name: regionName, tiles: cached, zoom }]);
      setStatus('cached');
    } catch (err) {
      setErrorMsg(err.message || 'Failed to cache map tiles.');
      setStatus('error');
    }
  }

  async function handleClearCache() {
    try {
      await caches.delete('sc-offline-maps-v1');
      setCachedRegions([]);
      setStatus('idle');
    } catch (err) {
      setErrorMsg(err.message);
      setStatus('error');
    }
  }

  return (
    <div
      className={`rounded-2xl border border-base-200 bg-base-100 p-4 space-y-3 ${className}`}
      aria-label="Offline map downloader"
    >
      <div className="flex items-center gap-2">
        <WifiOff size={16} className="text-primary" aria-hidden="true" />
        <p className="font-bold text-sm text-base-content">Offline Map</p>
      </div>

      {!swSupported && (
        <div className="flex items-start gap-2 text-xs text-base-content/60 bg-base-200 rounded-xl p-3">
          <Info size={14} className="flex-shrink-0 mt-0.5" aria-hidden="true" />
          <span>Offline maps require a supported browser with Service Workers enabled.</span>
        </div>
      )}

      {swSupported && status === 'idle' && (
        <>
          <p className="text-xs text-base-content/60">
            Save <strong>{regionName}</strong> for use without an internet connection.
            {bounds && (
              <> (~{estimateTiles(bounds, zoom.min, zoom.max)} tiles, zoom {zoom.min}–{zoom.max})</>
            )}
          </p>
          <Button size="sm" onClick={handleDownload} className="w-full gap-2">
            <Download size={14} aria-hidden="true" />
            Download for Offline
          </Button>
        </>
      )}

      {status === 'caching' && (
        <div className="space-y-2" role="status" aria-live="polite">
          <p className="text-xs font-semibold text-base-content/70">
            Caching map tiles… {progress}%
          </p>
          <div className="w-full bg-base-200 rounded-full h-2 overflow-hidden">
            <div
              className="h-2 bg-primary rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
              role="progressbar"
            />
          </div>
        </div>
      )}

      {status === 'cached' && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-success text-xs font-bold" role="status">
            <CheckCircle2 size={14} aria-hidden="true" />
            <span>{regionName} saved for offline use</span>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleClearCache}
            className="w-full text-error/80 hover:text-error text-xs"
          >
            Clear cached maps
          </Button>
        </div>
      )}

      {status === 'error' && (
        <div className="flex items-start gap-2 text-xs text-error bg-error/5 rounded-xl p-3" role="alert">
          <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" aria-hidden="true" />
          <span>{errorMsg}</span>
        </div>
      )}

      {cachedRegions.length > 0 && status !== 'caching' && (
        <div className="border-t border-base-200 pt-3 space-y-1">
          <p className="text-[10px] uppercase tracking-widest text-base-content/40 font-bold">Saved regions</p>
          {cachedRegions.map((r, i) => (
            <div key={i} className="flex items-center justify-between text-xs text-base-content/60">
              <span>{r.name}</span>
              <span className="text-[10px] text-base-content/40">{r.tiles} tiles</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

OfflineMapDownloader.propTypes = {
  regionName: PropTypes.string,
  bounds: PropTypes.arrayOf(
    PropTypes.arrayOf(PropTypes.number)
  ),
  zoom: PropTypes.shape({
    min: PropTypes.number,
    max: PropTypes.number,
  }),
  className: PropTypes.string,
};

export default OfflineMapDownloader;

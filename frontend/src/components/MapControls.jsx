import { Layers, LocateFixed, Plus, Minus } from 'lucide-react';
import { useMap } from 'react-leaflet';
import toast from 'react-hot-toast';

const LAYERS = [
  { id: 'street', label: 'Street' },
  { id: 'terrain', label: 'Terrain' },
  { id: 'dark', label: 'Dark' },
];

export default function MapControls({ activeLayer = 'street', onLayerChange }) {
  const map = useMap();

  const zoomIn = () => map.zoomIn();
  const zoomOut = () => map.zoomOut();

  const locateMe = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported on this device.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        map.setView([position.coords.latitude, position.coords.longitude], Math.max(map.getZoom(), 13));
      },
      () => {
        toast.error('Unable to access your location.');
      }
    );
  };

  return (
    <div className="leaflet-top leaflet-right" style={{ marginTop: 12, marginRight: 12 }}>
      <div className="leaflet-control rounded-xl overflow-hidden shadow-lg border border-base-300 bg-base-100">
        <button type="button" onClick={zoomIn} className="block p-2.5 hover:bg-base-200 border-b border-base-300" title="Zoom in">
          <Plus size={16} />
        </button>
        <button type="button" onClick={zoomOut} className="block p-2.5 hover:bg-base-200 border-b border-base-300" title="Zoom out">
          <Minus size={16} />
        </button>
        <button type="button" onClick={locateMe} className="block p-2.5 hover:bg-base-200 border-b border-base-300" title="Locate me">
          <LocateFixed size={16} />
        </button>
        <div className="p-2 space-y-1">
          <div className="flex items-center gap-1 text-[10px] font-black text-base-content/50 uppercase tracking-wider mb-1">
            <Layers size={10} /> Layers
          </div>
          {LAYERS.map((layer) => (
            <button
              type="button"
              key={layer.id}
              onClick={() => onLayerChange?.(layer.id)}
              className={`w-full text-left px-2 py-1 rounded text-[11px] font-bold ${activeLayer === layer.id ? 'bg-brand-vibrant/10 text-brand-vibrant' : 'hover:bg-base-200 text-base-content/70'}`}
            >
              {layer.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

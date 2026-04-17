import { MapPin, Shield, CloudSun, Search, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';

const TOOL_ICONS = {
  search_destinations: Search,
  get_safety_info: Shield,
  get_weather: CloudSun,
  search_places: MapPin,
};

const TOOL_LABELS = {
  search_destinations: 'Destinations found',
  get_safety_info: 'Safety information',
  get_weather: 'Weather data',
  search_places: 'Places nearby',
};

/**
 * AtlasToolResult — renders the result of an Atlas AI tool call
 *
 * Props:
 *  - tool: string  (e.g. 'search_destinations')
 *  - result: object (the JSON result returned by the tool)
 *  - className: string
 */
const AtlasToolResult = ({ tool, result, className = '' }) => {
  const [expanded, setExpanded] = useState(false);
  const Icon = TOOL_ICONS[tool] || Search;
  const label = TOOL_LABELS[tool] || tool;

  const renderContent = () => {
    if (!result) return <p className="text-xs text-base-content/50">No result data</p>;

    if (result.error) {
      return <p className="text-xs text-error">{result.error}</p>;
    }

    // Destinations list
    if (result.destinations) {
      return (
        <ul className="space-y-1 mt-1">
          {result.destinations.slice(0, 3).map((d, i) => (
            <li key={i} className="flex items-center gap-2 text-xs">
              <MapPin size={10} className="text-primary shrink-0" />
              <span className="font-medium">{d.name}</span>
              {d.country && <span className="text-base-content/50">· {d.country}</span>}
              {d.safety_rating && (
                <span className="badge badge-xs badge-outline capitalize">{d.safety_rating}</span>
              )}
            </li>
          ))}
          {result.destinations.length === 0 && (
            <li className="text-xs text-base-content/50">No destinations found</li>
          )}
        </ul>
      );
    }

    // Safety info
    if (result.safety_rating !== undefined || result.name) {
      return (
        <div className="space-y-1 text-xs">
          {result.name && <p className="font-medium">{result.name}</p>}
          {result.safety_rating && (
            <p>Safety: <span className="font-medium capitalize">{result.safety_rating}</span></p>
          )}
          {result.fcdo_alert_status && (
            <p>FCDO: <span className="font-medium">{result.fcdo_alert_status}</span></p>
          )}
          {result.safety_intelligence && (
            <p className="text-base-content/60 line-clamp-2">{result.safety_intelligence}</p>
          )}
          {result.message && <p className="text-base-content/60">{result.message}</p>}
        </div>
      );
    }

    // Generic message
    if (result.message) {
      return <p className="text-xs text-base-content/70">{result.message}</p>;
    }

    // Fallback: raw JSON (collapsed)
    return (
      <pre className="text-xs text-base-content/60 overflow-auto max-h-24 font-mono">
        {JSON.stringify(result, null, 2)}
      </pre>
    );
  };

  return (
    <div className={`rounded-lg border border-primary/20 bg-primary/5 p-2.5 my-1 ${className}`}>
      <button
        onClick={() => setExpanded(v => !v)}
        className="flex items-center gap-2 w-full text-left"
      >
        <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
          <Icon size={10} className="text-primary" />
        </div>
        <span className="text-xs font-medium text-primary flex-1">{label}</span>
        {expanded ? <ChevronUp size={12} className="text-primary" /> : <ChevronDown size={12} className="text-primary" />}
      </button>

      {expanded && (
        <div className="mt-2 pl-7">
          {renderContent()}
        </div>
      )}
    </div>
  );
};

export default AtlasToolResult;

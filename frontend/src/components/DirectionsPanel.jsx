import TransitDirections from './TransitDirections';
import TransitDirectionsLeaflet from './TransitDirectionsLeaflet';

export default function DirectionsPanel({ variant = 'standard', ...props }) {
  if (variant === 'leaflet') {
    return <TransitDirectionsLeaflet {...props} />;
  }
  return <TransitDirections {...props} />;
}

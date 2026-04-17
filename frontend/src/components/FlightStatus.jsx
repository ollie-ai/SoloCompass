import { useState } from 'react';
import { 
  Plane, 
  Search, 
  Loader2, 
  PlaneTakeoff, 
  PlaneLanding, 
  Clock, 
  AlertCircle,
  CheckCircle2,
  XCircle,
  Calendar,
  MapPin,
  User,
  RefreshCw,
  Plus
} from 'lucide-react';
import api from '../lib/api';
import toast from 'react-hot-toast';
import Button from './Button';

const FlightStatusCard = ({ flight, onAddToTrip, tripId }) => {
  const getStatusConfig = (status) => {
    switch (status?.toLowerCase()) {
      case 'active':
      case 'scheduled':
      case 'en-route':
        return { 
          bg: 'bg-success/10', 
          border: 'border-success/30', 
          text: 'text-success',
          icon: <CheckCircle2 size={18} className="text-emerald-500" />,
          label: 'On Time'
        };
      case 'delayed':
        return { 
          bg: 'bg-warning/10', 
          border: 'border-warning/30', 
          text: 'text-warning',
          icon: <AlertCircle size={18} className="text-warning" />,
          label: 'Delayed'
        };
      case 'cancelled':
        return { 
          bg: 'bg-error/10', 
          border: 'border-error/30', 
          text: 'text-error',
          icon: <XCircle size={18} className="text-error" />,
          label: 'Cancelled'
        };
      case 'landed':
        return { 
          bg: 'bg-blue-50', 
          border: 'border-blue-200', 
          text: 'text-blue-700',
          icon: <CheckCircle2 size={18} className="text-blue-500" />,
          label: 'Landed'
        };
      case 'incident':
      case 'diverted':
        return { 
          bg: 'bg-error/10', 
          border: 'border-error/30', 
          text: 'text-error',
          icon: <AlertCircle size={18} className="text-error" />,
          label: status.charAt(0).toUpperCase() + status.slice(1)
        };
      default:
        return { 
          bg: 'bg-base-200', 
          border: 'border-base-300', 
          text: 'text-base-content/80',
          icon: <Clock size={18} className="text-base-content/40" />,
          label: status || 'Unknown'
        };
    }
  };

  const formatTime = (dateString) => {
    if (!dateString) return '--:--';
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  };

  const getAirportTimeLabel = (segment) => {
    if (!segment) return '--:--';
    return segment.local_time_label || formatTime(segment.scheduled || segment.estimated);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const getDelayText = (delay) => {
    if (!delay || delay <= 0) return null;
    const hours = Math.floor(delay / 60);
    const mins = delay % 60;
    if (hours > 0) return `${hours}h ${mins}m delayed`;
    return `${mins}m delayed`;
  };

  const statusConfig = getStatusConfig(flight.status);
  const departureDelay = flight.departure?.delay;
  const arrivalDelay = flight.arrival?.delay;

  return (
    <div className={`glass-card rounded-xl border-2 ${statusConfig.border} overflow-hidden`}>
      <div className={`${statusConfig.bg} px-6 py-4 flex items-center justify-between`}>
        <div className="flex items-center gap-3">
          <Plane size={24} className="text-base-content" />
          <div>
            <h3 className="text-xl font-black text-base-content">{flight.flight_number}</h3>
            <p className="text-sm font-medium text-base-content/80">{flight.airline}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {statusConfig.icon}
          <span className={`font-bold ${statusConfig.text}`}>{statusConfig.label}</span>
        </div>
      </div>

      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <PlaneTakeoff size={16} className="text-base-content/40" />
              <span className="text-xs font-bold text-base-content/40 uppercase tracking-wider">Departure</span>
            </div>
            <p className="text-2xl font-black text-base-content">{flight.departure?.iata}</p>
            <p className="text-sm font-medium text-base-content/80">{flight.departure?.airport}</p>
            <p className="text-sm font-medium text-base-content/60">{flight.departure?.city}</p>
          </div>

          <div className="flex-1 text-center px-4">
            <div className="flex items-center justify-center gap-1 mb-2">
              <div className="w-2 h-2 rounded-full bg-base-300"></div>
              <div className="flex-1 h-0.5 bg-base-300 relative">
                <Plane size={16} className="text-brand-vibrant absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-base-100 px-1" />
              </div>
              <div className="w-2 h-2 rounded-full bg-brand-vibrant"></div>
            </div>
            <p className="text-xs font-medium text-base-content/60">
              {flight.departure?.timezone && flight.arrival?.timezone ? 
                `${flight.arrival?.timezone} → ${flight.departure?.timezone}` : 
                'Direct'}
            </p>
          </div>

          <div className="flex-1 text-right">
            <div className="flex items-center justify-end gap-2 mb-1">
              <span className="text-xs font-bold text-base-content/40 uppercase tracking-wider">Arrival</span>
              <PlaneLanding size={16} className="text-base-content/40" />
            </div>
            <p className="text-2xl font-black text-base-content">{flight.arrival?.iata}</p>
            <p className="text-sm font-medium text-base-content/80">{flight.arrival?.airport}</p>
            <p className="text-sm font-medium text-base-content/60">{flight.arrival?.city}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-base-300/50">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-base-content/40 uppercase">Scheduled</span>
              <span className="text-sm font-black text-base-content">{getAirportTimeLabel(flight.departure)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-base-content/40 uppercase">Estimated</span>
              <span className="text-sm font-black text-base-content">{formatTime(flight.departure?.estimated)}</span>
            </div>
            {departureDelay > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-warning uppercase">Delay</span>
                <span className="text-sm font-black text-warning">{getDelayText(departureDelay)}</span>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-base-content/40 uppercase">Scheduled</span>
              <span className="text-sm font-black text-base-content">{getAirportTimeLabel(flight.arrival)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-base-content/40 uppercase">Estimated</span>
              <span className="text-sm font-black text-base-content">{formatTime(flight.arrival?.estimated)}</span>
            </div>
            {arrivalDelay > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-warning uppercase">Delay</span>
                <span className="text-sm font-black text-warning">{getDelayText(arrivalDelay)}</span>
              </div>
            )}
          </div>
        </div>

        {(flight.departure?.terminal || flight.departure?.gate || flight.arrival?.terminal || flight.arrival?.gate) && (
          <div className="mt-4 pt-4 border-t border-base-300/50 grid grid-cols-2 gap-4">
            {flight.departure?.terminal && (
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-base-content/40 uppercase">Dep. Terminal</span>
                <span className="text-sm font-bold text-base-content/80">{flight.departure.terminal}</span>
              </div>
            )}
            {flight.departure?.gate && (
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-base-content/40 uppercase">Dep. Gate</span>
                <span className="text-sm font-bold text-base-content/80">{flight.departure.gate}</span>
              </div>
            )}
            {flight.arrival?.terminal && (
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-base-content/40 uppercase">Arr. Terminal</span>
                <span className="text-sm font-bold text-base-content/80">{flight.arrival.terminal}</span>
              </div>
            )}
            {flight.arrival?.gate && (
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-base-content/40 uppercase">Arr. Gate</span>
                <span className="text-sm font-bold text-base-content/80">{flight.arrival.gate}</span>
              </div>
            )}
          </div>
        )}

        {onAddToTrip && (
          <div className="mt-4 pt-4 border-t border-base-300/50 flex justify-end">
            <Button
              onClick={() => onAddToTrip(flight)}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Plus size={16} /> Add to Trip
            </Button>
          </div>
        )}

        {flight.updated && (
          <p className="text-xs text-base-content/40 mt-4 text-center">
            Last updated: {new Date(flight.updated).toLocaleString()}
          </p>
        )}
      </div>
    </div>
  );
};

const FlightSearch = ({ onFlightFound, onAddToTrip, tripId }) => {
  const [flightNumber, setFlightNumber] = useState('');
  const [date, setDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const getToday = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!flightNumber.trim()) {
      setError('Please enter a flight number');
      return;
    }
    if (!date) {
      setError('Please select a date');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await api.get('/flights/search', {
        params: {
          flight_number: flightNumber.trim().toUpperCase(),
          date: date
        }
      });
      onFlightFound?.(response.data.data);
    } catch (err) {
      console.error('Flight search error:', err);
      if (err.response?.status === 404) {
        setError('Flight not found. Please check the flight number and date.');
      } else {
        setError(err.response?.data?.error || 'Failed to search for flight');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <form onSubmit={handleSearch} className="space-y-4">
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-base-content/40 uppercase tracking-wider mb-2">
              Flight Number
            </label>
            <div className="relative">
              <Plane className="absolute left-4 top-1/2 -translate-y-1/2 text-base-content/40" size={18} />
              <input
                type="text"
                value={flightNumber}
                onChange={(e) => setFlightNumber(e.target.value.toUpperCase())}
                placeholder="e.g. BA123, UAL456"
                className="w-full pl-12 pr-4 py-3 rounded-xl border border-base-300 focus:border-brand-vibrant focus:ring-2 focus:ring-brand-vibrant/20 outline-none font-bold text-base-content placeholder:text-base-content/30"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-base-content/40 uppercase tracking-wider mb-2">
              Date
            </label>
            <div className="relative">
              <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-base-content/40" size={18} />
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                min={getToday()}
                className="w-full pl-12 pr-4 py-3 rounded-xl border border-base-300 focus:border-brand-vibrant focus:ring-2 focus:ring-brand-vibrant/20 outline-none font-bold text-base-content"
              />
            </div>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-error/10 border border-error/30 rounded-xl">
            <AlertCircle size={18} className="text-error" />
            <span className="text-sm font-medium text-error">{error}</span>
          </div>
        )}

        <Button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              Searching...
            </>
          ) : (
            <>
              <Search size={18} />
              Search Flight
            </>
          )}
        </Button>
      </form>
    </div>
  );
};

const FlightStatusWidget = ({ initialFlightNumber = '', initialDate = '', onAddToTrip, tripId, compact = false }) => {
  const [flight, setFlight] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleFlightFound = (flightData) => {
    setFlight(flightData);
    setError(null);
  };

  const handleRefresh = async () => {
    if (!flight) return;
    
    setLoading(true);
    try {
      const response = await api.get('/flights/search', {
        params: {
          flight_number: flight.flight_number,
          date: flight.departure?.scheduled?.split('T')[0]
        }
      });
      setFlight(response.data.data);
      toast.success('Flight status updated');
    } catch (err) {
      toast.error('Failed to refresh flight status');
    } finally {
      setLoading(false);
    }
  };

  const handleAddToTrip = (flightData) => {
    onAddToTrip?.(flightData);
  };

  if (compact) {
    if (!flight) {
      return (
        <FlightSearch 
          onFlightFound={handleFlightFound} 
          onAddToTrip={handleAddToTrip}
          tripId={tripId}
        />
      );
    }

    return (
      <FlightStatusCard 
        flight={flight} 
        onAddToTrip={onAddToTrip ? handleAddToTrip : undefined}
        tripId={tripId}
      />
    );
  }

  return (
    <div className="space-y-6">
      {!flight ? (
        <div className="glass-card p-8 rounded-xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl bg-brand-vibrant/10 flex items-center justify-center">
              <Plane size={24} className="text-brand-vibrant" />
            </div>
            <div>
              <h3 className="text-xl font-black text-base-content">Flight Status</h3>
              <p className="text-sm text-base-content/60">Check your flight details</p>
            </div>
          </div>
          
          <FlightSearch 
            onFlightFound={handleFlightFound}
            onAddToTrip={handleAddToTrip}
            tripId={tripId}
          />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setFlight(null)}
              className="text-sm font-bold text-base-content/60 hover:text-base-content flex items-center gap-1"
            >
              ← Search another flight
            </button>
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="text-sm font-bold text-brand-vibrant hover:text-base-content flex items-center gap-1"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
          
          <FlightStatusCard 
            flight={flight}
            onAddToTrip={onAddToTrip ? handleAddToTrip : undefined}
            tripId={tripId}
          />
        </div>
      )}
    </div>
  );
};

export default FlightStatusWidget;
export { FlightStatusCard, FlightSearch };

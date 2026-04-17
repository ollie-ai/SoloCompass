import { Link } from 'react-router-dom';
import { ArrowLeft, MapPin, Calendar, Zap, Edit3, Download, ShieldCheck, Loader2 } from 'lucide-react';
import Button from '../Button';

const getStatusStyle = (status) => {
  switch (status) {
    case 'completed': return 'bg-success/20 text-success border-success/30';
    case 'confirmed': return 'bg-sky-100 text-info border-info/30';
    case 'cancelled': return 'bg-red-100 text-error border-error/30';
    default: return 'bg-warning/20 text-warning border-warning/30';
  }
};

function TripHeader({ trip, exporting, onExportPDF, onSafetyCheckIn, onShowRegenerate, onShowVersions, onShowEditTrip }) {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
      <div className="space-y-4">
        <Link to="/trips" className="group flex items-center gap-2 text-base-content/40 hover:text-base-content font-bold transition-colors">
          <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" /> Back to Trips
        </Link>

        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-4">
            <h1 className="text-4xl font-black text-base-content tracking-tight">{trip?.name}</h1>
            <button
              onClick={onShowEditTrip}
              className="p-2 text-base-content/20 hover:text-brand-vibrant hover:bg-brand-vibrant/5 rounded-xl transition-all"
              title="Edit Trip Details"
            >
              <Edit3 size={20} />
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1 bg-base-100 border border-base-content/10 rounded-full shadow-sm">
              <MapPin size={14} className="text-brand-vibrant" />
              <span className="text-sm font-bold text-base-content/60">{trip?.destination}</span>
            </div>

            <div className="flex items-center gap-2 px-3 py-1 bg-base-100 border border-base-content/10 rounded-full shadow-sm">
              <Calendar size={14} className="text-indigo-500" />
              <span className="text-sm font-bold text-base-content/60">
                {trip?.start_date ? new Date(trip.start_date).toLocaleDateString() : 'TBD'} -{' '}
                {trip?.end_date ? new Date(trip.end_date).toLocaleDateString() : 'TBD'}
              </span>
            </div>

            <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border shadow-sm ${getStatusStyle(trip?.status)}`}>
              {trip?.status}
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          onClick={onShowRegenerate}
          variant="outline"
          className="rounded-xl font-bold border-brand-vibrant/30 text-brand-vibrant hover:bg-brand-vibrant/5 shadow-sm"
        >
          <Zap size={18} className="mr-2" /> Regenerate
        </Button>
        {trip?.itinerary?.length > 0 && (
          <Button
            onClick={onShowVersions}
            variant="outline"
            className="rounded-xl font-bold border-base-content/10 shadow-sm text-base-content/60"
          >
            <Loader2 size={18} className="mr-2" /> Versions
          </Button>
        )}
        <Button
          onClick={onExportPDF}
          disabled={exporting}
          variant="outline"
          className="rounded-xl font-bold border-base-content/10 shadow-sm text-base-content/60"
        >
          {exporting ? <Loader2 size={18} className="animate-spin mr-2" /> : <Download size={18} className="mr-2" />} Export PDF
        </Button>
        <Button
          onClick={onSafetyCheckIn}
          className="rounded-xl font-black bg-brand-vibrant hover:bg-brand-vibrant/90 shadow-xl shadow-brand-vibrant/20"
        >
          <ShieldCheck size={18} className="mr-2" /> Safety Check-in
        </Button>
      </div>
    </div>
  );
}

export default TripHeader;

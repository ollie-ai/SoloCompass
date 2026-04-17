import { Sparkles, Package, Wallet, Building, Ticket, FileText, Bookmark, ChevronRight, Calendar } from 'lucide-react';
import Skeleton from '../Skeleton';
import Button from '../Button';
import WeatherWidget from '../WeatherWidget';
import CurrencyConverter from '../CurrencyConverter';
import PlacesSearch from '../PlacesSearch';
import DirectionsPanel from '../DirectionsPanel';
import AffiliateLinks from '../AffiliateLinks';
import FlightStatusWidget from '../FlightStatus';
import FeatureGate from '../FeatureGate';
import SoloSafetyHub from '../SoloSafetyHub';
import OfflineMapDownloader from '../OfflineMapDownloader';
import { FEATURES } from '../../config/features';

function TripSidebar({
  trip,
  loading,
  generating,
  totalCost,
  totalActivities,
  accommodations,
  bookings,
  documents,
  savedPlaces,
  contacts,
  tripId,
  onGenerateItinerary,
  onAddFlightToTrip,
  setShowPackingList,
  setShowBudget,
  setShowAccommodation,
  setShowBookings,
  setShowDocuments,
  setShowPlaces,
  setShowCheckIn,
}) {
  return (
    <div className="space-y-8">
      <SoloSafetyHub
        trip={trip}
        contacts={contacts}
        onOpenContacts={() => setShowDocuments?.(true)}
        onOpenTimer={() => setShowCheckIn?.(true)}
      />

      {trip?.destination && <WeatherWidget city={trip.destination} />}

      {/* Trip Details Card */}
      <div className="glass-card p-8 rounded-xl shadow-xl">
        <h3 className="text-xl font-black text-base-content mb-6 flex items-center gap-2">
          <Calendar className="text-brand-vibrant" /> Trip Details
        </h3>
        {loading || !trip ? (
          <div className="space-y-4">
            <Skeleton className="h-10 w-full rounded-xl" />
            <Skeleton className="h-10 w-full rounded-xl" />
            <Skeleton className="h-10 w-full rounded-xl" />
          </div>
        ) : (
          <div className="space-y-6">
            <div>
              <p className="text-[10px] font-black text-base-content/40 uppercase tracking-widest mb-1">Duration</p>
              <p className="font-bold text-base-content/70">
                {trip.start_date ? new Date(trip.start_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'TBD'}
                {' — '}
                {trip.end_date ? new Date(trip.end_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'TBD'}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-black text-base-content/40 uppercase tracking-widest mb-1">Budget Allocation</p>
              <div className="flex items-end gap-2">
                <p className="text-2xl font-black text-base-content">£{totalCost.toLocaleString()}</p>
                <p className="text-sm font-bold text-base-content/40 mb-1">/ £{trip.budget?.toLocaleString() || '0'}</p>
              </div>
              <div className="w-full bg-base-200 rounded-full h-2 mt-2">
                <div className="bg-brand-vibrant h-2 rounded-full" style={{ width: `${Math.min((totalCost / (trip.budget || 1)) * 100, 100)}%` }}></div>
              </div>
            </div>
            <div>
              <p className="text-[10px] font-black text-base-content/40 uppercase tracking-widest mb-1">Activities</p>
              <p className="font-bold text-base-content/70">{totalActivities} Activities planned</p>
            </div>
          </div>
        )}
        {trip?.notes && (
          <div className="mt-8 pt-8 border-t border-base-content/10">
            <p className="text-[10px] font-black text-base-content/40 uppercase tracking-widest mb-2">My Planning Notes</p>
            <p className="text-sm text-base-content/60 leading-relaxed italic">&quot;{trip.notes}&quot;</p>
          </div>
        )}
      </div>

      {/* AI Itinerary Card */}
      <div className="p-8 rounded-xl bg-brand-deep text-white shadow-xl relative overflow-hidden">
        <div className="absolute -right-4 -top-4 w-24 h-24 bg-brand-vibrant/20 rounded-full blur-2xl"></div>
        <Sparkles className="text-brand-vibrant mb-6" size={32} />
        <h4 className="text-xl font-black mb-2">AI Itinerary</h4>
        <p className="text-sm text-white/60 font-medium mb-8 leading-relaxed">
          {trip?.itinerary?.length > 0
            ? "Your itinerary is ready. You can regenerate it if you've changed your travel dates or notes."
            : "Your itinerary hasn't been designed yet. Let our specialist AI build your solo adventure."}
        </p>
        <Button
          onClick={onGenerateItinerary}
          disabled={generating}
          variant="primary"
          className="w-full py-4 rounded-xl font-black btn-premium shadow-lg transition-all"
        >
          {generating ? 'Processing DNA...' : trip?.itinerary?.length > 0 ? 'Regenerate Itinerary' : 'Generate with AI'}
        </Button>
      </div>

      {/* Packing List Card */}
      <FeatureGate feature="PACKING">
        <button
          onClick={() => setShowPackingList?.(true)}
          className="w-full p-8 rounded-xl bg-base-200 border-2 border-amber-500/20 shadow-lg hover:shadow-xl hover:border-amber-500/40 transition-all group text-left"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="w-14 h-14 rounded-xl bg-amber-500/10 flex items-center justify-center group-hover:bg-amber-500/20 transition-colors">
              <Package size={28} className="text-warning" />
            </div>
            <ChevronRight size={20} className="text-amber-500/40 group-hover:translate-x-1 transition-transform" />
          </div>
          <h4 className="text-lg font-black text-base-content mb-1">Packing List</h4>
          <p className="text-sm text-base-content/60 font-medium">Never forget essentials again</p>
        </button>
      </FeatureGate>

      {/* Budget Tracker Card */}
      <FeatureGate feature="BUDGET">
        <button
          onClick={() => setShowBudget?.(true)}
          className="w-full p-8 rounded-xl bg-base-200 border-2 border-emerald-500/20 shadow-lg hover:shadow-xl hover:border-emerald-500/40 transition-all group text-left"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="w-14 h-14 rounded-xl bg-emerald-500/10 flex items-center justify-center group-hover:bg-emerald-500/20 transition-colors">
              <Wallet size={28} className="text-emerald-500" />
            </div>
            <ChevronRight size={20} className="text-emerald-500/40 group-hover:translate-x-1 transition-transform" />
          </div>
          <h4 className="text-lg font-black text-base-content mb-1">Budget Tracker</h4>
          <p className="text-sm text-base-content/60 font-medium">Track your trip expenses</p>
        </button>
      </FeatureGate>

      {/* Accommodation Card */}
      <button
        onClick={() => setShowAccommodation?.(true)}
        className="w-full p-8 rounded-xl bg-base-200 border-2 border-indigo-500/20 shadow-lg hover:shadow-xl hover:border-indigo-500/40 transition-all group text-left"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="w-14 h-14 rounded-xl bg-indigo-500/10 flex items-center justify-center group-hover:bg-indigo-500/20 transition-colors">
            <Building size={28} className="text-indigo-500" />
          </div>
          <ChevronRight size={20} className="text-indigo-500/40 group-hover:translate-x-1 transition-transform" />
        </div>
        <h4 className="text-lg font-black text-base-content mb-1">Accommodation</h4>
        <p className="text-sm text-base-content/60 font-medium">
          {accommodations?.length > 0 ? `${accommodations.length} booking(s)` : 'Add your stays'}
        </p>
      </button>

      {/* Bookings Card */}
      <button
        onClick={() => setShowBookings?.(true)}
        className="w-full p-8 rounded-xl bg-base-200 border-2 border-cyan-500/20 shadow-lg hover:shadow-xl hover:border-cyan-500/40 transition-all group text-left"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="w-14 h-14 rounded-xl bg-cyan-500/10 flex items-center justify-center group-hover:bg-cyan-500/20 transition-colors">
            <Ticket size={28} className="text-cyan-500" />
          </div>
          <ChevronRight size={20} className="text-cyan-500/40 group-hover:translate-x-1 transition-transform" />
        </div>
        <h4 className="text-lg font-black text-base-content mb-1">Bookings</h4>
        <p className="text-sm text-base-content/60 font-medium">
          {bookings?.length > 0 ? `${bookings.length} booking(s)` : 'Transport & tours'}
        </p>
      </button>

      {/* Documents Card */}
      <button
        onClick={() => setShowDocuments?.(true)}
        className="w-full p-8 rounded-xl bg-base-200 border-2 border-rose-500/20 shadow-lg hover:shadow-xl hover:border-rose-500/40 transition-all group text-left"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="w-14 h-14 rounded-xl bg-rose-500/10 flex items-center justify-center group-hover:bg-rose-500/20 transition-colors">
            <FileText size={28} className="text-rose-500" />
          </div>
          <ChevronRight size={20} className="text-rose-500/40 group-hover:translate-x-1 transition-transform" />
        </div>
        <h4 className="text-lg font-black text-base-content mb-1">Documents</h4>
        <p className="text-sm text-base-content/60 font-medium">
          {documents?.length > 0 ? `${documents.length} document(s)` : 'Passport, visa, insurance'}
        </p>
      </button>

      {/* Saved Places Card */}
      <button
        onClick={() => setShowPlaces?.(true)}
        className="w-full p-8 rounded-xl bg-violet-50 border-2 border-violet-200 shadow-lg hover:shadow-xl hover:border-violet-300 transition-all group text-left"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="w-14 h-14 rounded-xl bg-violet-100 flex items-center justify-center group-hover:bg-violet-200 transition-colors">
            <Bookmark size={28} className="text-violet-600" />
          </div>
          <ChevronRight size={20} className="text-violet-400 group-hover:translate-x-1 transition-transform" />
        </div>
        <h4 className="text-lg font-black text-violet-900 mb-1">Saved Places</h4>
        <p className="text-sm text-violet-700 font-medium">
          {savedPlaces?.length > 0 ? `${savedPlaces.length} place(s)` : 'Spots to explore'}
        </p>
      </button>

      {/* Flight Status Widget */}
      {FEATURES.FLIGHTS && tripId && (
        <div className="mt-6">
          <FlightStatusWidget
            tripId={tripId}
            onAddToTrip={onAddFlightToTrip}
          />
        </div>
      )}

      {/* Currency Converter */}
      <div className="mt-6">
        <CurrencyConverter defaultFrom="GBP" defaultTo="EUR" initialAmount={100} />
      </div>

      {/* Places Search */}
      <div className="mt-6">
        <PlacesSearch destination={trip?.destination} />
      </div>

      {/* Transit Directions */}
      <div className="mt-6">
        <DirectionsPanel destination={trip?.destination} />
      </div>

      {/* Affiliate Links */}
      <div className="mt-6">
        <AffiliateLinks destination={trip?.destination} />
      </div>

      {/* Offline Map Download */}
      {trip?.destination && (
        <div className="mt-6">
          <OfflineMapDownloader
            label={`${trip.destination} — Offline Tiles`}
            bounds={
              trip.destination_lat && trip.destination_lng
                ? {
                    north: trip.destination_lat + 0.3,
                    south: trip.destination_lat - 0.3,
                    east: trip.destination_lng + 0.4,
                    west: trip.destination_lng - 0.4,
                  }
                : null
            }
          />
        </div>
      )}
    </div>
  );
}

export default TripSidebar;

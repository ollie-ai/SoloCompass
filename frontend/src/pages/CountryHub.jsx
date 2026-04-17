/**
 * CountryHub — Country-level destination page.
 * Orients the user, shows advisory + entry info, regional differences,
 * links to top cities, and provides high-level solo-travel decision support.
 */

import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api from '../lib/api';
import Loading from '../components/Loading';
import SEO from '../components/SEO';
import DashboardShell from '../components/dashboard/DashboardShell';
import DestinationTrustStrip from '../components/destinations/DestinationTrustStrip';
import CountryHero from '../components/destinations/CountryHero';
import QuickFitCards from '../components/destinations/QuickFitCards';
import StickyJumpNav from '../components/destinations/StickyJumpNav';
import OfficialAdvisoryCard from '../components/destinations/OfficialAdvisoryCard';
import TravelAdvisoryBanner from '../components/destinations/TravelAdvisoryBanner';
import RegionalDifferences from '../components/destinations/RegionalDifferences';
import BestCitiesShelf from '../components/destinations/BestCitiesShelf';
import BudgetSnapshot from '../components/destinations/BudgetSnapshot';
import SocialEaseModule from '../components/destinations/SocialEaseModule';
import DigitalNomadCards from '../components/destinations/DigitalNomadCards';
import SourceLabel from '../components/destinations/SourceLabel';
import AffiliateHub from '../components/destinations/AffiliateHub';
import CityCard from '../components/destinations/CityCard';
import DestinationChat from '../components/DestinationChat';
import PlanGate from '../components/PlanGate';
import Skeleton from '../components/Skeleton';
import {
  Globe, ShieldCheck, AlertTriangle, MapPin, ArrowLeft, CheckCircle,
  ExternalLink, Sparkles, ChevronRight, BookmarkPlus
} from 'lucide-react';

function parseTags(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try { return JSON.parse(raw); } catch { return []; }
}

const ADVISORY_BANNER = {
  normal: null,
  exercise_caution: {
    icon: AlertTriangle,
    color: 'border-yellow-400/40 bg-yellow-500/5 text-yellow-700 dark:text-yellow-400',
    label: 'FCDO advises to exercise caution in some areas.',
  },
  advise_against: {
    icon: AlertTriangle,
    color: 'border-orange-400/40 bg-orange-500/5 text-orange-700 dark:text-orange-400',
    label: 'FCDO advises against some travel to this country.',
  },
  advise_against_all: {
    icon: AlertTriangle,
    color: 'border-red-400/40 bg-red-500/5 text-red-700 dark:text-red-400',
    label: 'FCDO advises against all travel to this country.',
  },
};

export default function CountryHub() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [destination, setDestination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchDestination = async () => {
      try {
        setLoading(true);
        const res = await api.get(`/destinations/by-slug/${slug}`);
        const data = res.data.data;
        // If this is a city, redirect to city hub
        if (data.destination_level === 'city') {
          navigate(`/destinations/cities/${slug}`, { replace: true });
          return;
        }
        setDestination(data);
        setError(null);
      } catch (err) {
        setError('Destination not found.');
      } finally {
        setLoading(false);
      }
    };
    fetchDestination();
  }, [slug, navigate]);

  if (loading) return (
    <DashboardShell>
      {/* Skeleton hero */}
      <div className="skeleton h-64 md:h-80 w-full rounded-none" />
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        {/* Country name + tags */}
        <div className="space-y-3">
          <Skeleton className="h-3 w-40" />
          <Skeleton className="h-10 w-80" />
          <div className="flex gap-2">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-6 w-20 rounded-full" />)}
          </div>
          <Skeleton className="h-4 w-full max-w-2xl" />
          <Skeleton className="h-4 w-4/5 max-w-2xl" />
        </div>
        {/* Section cards */}
        <div className="grid md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-6">
            <Skeleton className="h-48 rounded-2xl" />
            <Skeleton className="h-36 rounded-2xl" />
            <Skeleton className="h-56 rounded-2xl" />
          </div>
          <div className="space-y-4">
            <Skeleton className="h-64 rounded-2xl" />
            <Skeleton className="h-40 rounded-2xl" />
          </div>
        </div>
      </div>
    </DashboardShell>
  );
  if (error || !destination) {
    return (
      <DashboardShell>
        <div className="max-w-2xl mx-auto py-20 text-center space-y-4">
          <p className="text-4xl">🌍</p>
          <p className="text-xl font-black">{error || 'Destination not found'}</p>
          <Link to="/destinations" className="text-brand-vibrant underline text-sm">Back to destinations</Link>
        </div>
      </DashboardShell>
    );
  }

  const {
    name, title, description, image_url, country, region_name,
    advisory_stance, advisory_summary, advisory_checked_at, fcdo_slug,
    safety_rating, safety_intelligence, emergency_contacts,
    solo_fit_tags, best_for_tags, highlights = [], linked_cities = [],
    short_summary, why_solo_travellers, ideal_trip_length,
    content_blocks = {},
    positioning_summary,
    caution_for_tags,
    daily_budget_min,
    daily_budget_max,
    backpacker_daily,
    comfort_daily,
    currency_code,
    plug_type,
    time_zone,
    card_acceptance_score,
    wifi_reliability_score,
    coworking_density,
    visa_remote_friendliness,
    english_accessibility,
    solo_social_score,
    hostel_culture_score,
    meetup_density,
    first_time_solo_friendly,
    regional_differences_summary,
    easiest_first_regions,
    higher_risk_regions,
    source_label,
    entry_requirements_snapshot,
    official_advisory_detail,
    research_workflow_state,
    research_completeness_score,
    launch_cities,
    language_summary,
    transport_summary,
    payment_notes,
    sim_esim_notes,
    climate_summary,
  } = destination;

  const displayName = title || name;
  const soloTags = parseTags(solo_fit_tags);
  const bestForTags = parseTags(best_for_tags);
  const highlightsList = typeof highlights === 'string' ? JSON.parse(highlights || '[]') : (highlights || []);
  const advisoryBanner = advisory_stance ? ADVISORY_BANNER[advisory_stance] : null;

  return (
    <DashboardShell>
      <SEO
        title={`${displayName} — Solo Travel Country Guide`}
        description={description?.slice(0, 160) || `Solo travel guide for ${displayName}.`}
      />

      {/* Trust strip — always at the top */}
      <DestinationTrustStrip destination={destination} />

      {/* Source label */}
      <div className="max-w-6xl mx-auto px-4 pt-4">
        <SourceLabel type={source_label} />
      </div>

      {/* Hero - NEW component */}
      <CountryHero
        destination={destination}
        displayName={displayName}
        region_name={region_name}
        image_url={image_url}
        soloTags={soloTags}
        positioning_summary={positioning_summary}
        why_solo_travellers={why_solo_travellers}
        ideal_trip_length={ideal_trip_length}
        first_time_solo_friendly={first_time_solo_friendly}
        safety_rating={safety_rating}
      />

      {/* Sticky Jump Nav */}
      <StickyJumpNav
        sections={[
          { id: 'overview', label: 'Overview' },
          { id: 'advisory', label: 'Advisory' },
          { id: 'regions', label: 'Regions' },
          { id: 'cities', label: 'Cities' },
          { id: 'budget', label: 'Budget' },
          { id: 'social', label: 'Social' },
          { id: 'remote-work', label: 'Remote Work' },
          { id: 'atlas', label: 'Atlas' },
          { id: 'plan', label: 'Plan' },
        ]}
      />

      <div className="max-w-6xl mx-auto px-4 py-8 space-y-10">
        {/* Section 1: QuickFitCards - 4-up cards */}
        <QuickFitCards
          soloTags={soloTags}
          bestForTags={bestForTags}
          solo_social_score={solo_social_score}
          hostel_culture_score={hostel_culture_score}
          first_time_solo_friendly={first_time_solo_friendly}
          english_accessibility={english_accessibility}
        />

        {/* Section 2: OfficialAdvisoryCard - advisory + entry */}
        <TravelAdvisoryBanner
          destination={destination}
          dismissable
        />
        <OfficialAdvisoryCard
          destination={destination}
          advisory_stance={advisory_stance}
          advisory_summary={advisory_summary}
          fcdo_slug={fcdo_slug}
          official_advisory_detail={official_advisory_detail}
          entry_requirements_snapshot={entry_requirements_snapshot}
          caution_for_tags={caution_for_tags}
        />

        {/* Section 3: RegionalDifferences - regional summary */}
        <RegionalDifferences
          regional_differences_summary={regional_differences_summary}
          easiest_first_regions={easiest_first_regions}
          higher_risk_regions={higher_risk_regions}
        />

        {/* Section 4: BestCitiesShelf - cities with compare */}
        <BestCitiesShelf
          linked_cities={linked_cities}
          launch_cities={launch_cities}
          displayName={displayName}
        />

        {/* Section 5: BudgetSnapshot - budget + currency */}
        <BudgetSnapshot
          daily_budget_min={daily_budget_min}
          daily_budget_max={daily_budget_max}
          backpacker_daily={backpacker_daily}
          comfort_daily={comfort_daily}
          currency_code={currency_code}
          language_summary={language_summary}
          transport_summary={transport_summary}
          payment_notes={payment_notes}
        />

        {/* Section 6: SocialEaseModule - social + Solo-Vibe */}
        <SocialEaseModule
          meetup_density={meetup_density}
          solo_social_score={solo_social_score}
          hostel_culture_score={hostel_culture_score}
          displayName={displayName}
        />

        {/* Section 7: DigitalNomadCards - remote work */}
        <DigitalNomadCards
          wifi_reliability_score={wifi_reliability_score}
          card_acceptance_score={card_acceptance_score}
          coworking_density={coworking_density}
          visa_remote_friendliness={visa_remote_friendliness}
          plug_type={plug_type}
          time_zone={time_zone}
          sim_esim_notes={sim_esim_notes}
          climate_summary={climate_summary}
        />

        {/* Section 8: Atlas Country Chat */}
        <section id="atlas">
          <PlanGate
            minPlan="navigator"
            title="Ask Atlas about this country"
            description="Upgrade to Navigator to ask Atlas about safety, entry requirements, culture, and itinerary ideas for this country."
          >
            <DestinationChat 
              destinationId={destination.id} 
              destinationName={displayName} 
              destinationLevel="country"
            />
          </PlanGate>
        </section>

        {/* Section 9: Planning CTA */}
        <section id="plan" className="py-8 border-t border-base-300/30">
          <div className="text-center space-y-4">
            <h2 className="text-2xl font-black text-base-content">Ready to plan your trip?</h2>
            <p className="text-base-content/60">Start building your itinerary with personalized recommendations.</p>
            <Link
              to="/trips/new"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-brand-vibrant text-white font-black text-lg transition-all hover:bg-brand-vibrant/90 hover:shadow-lg hover:shadow-brand-vibrant/20"
            >
              <Sparkles size={20} /> Start planning
            </Link>
          </div>
        </section>
      </div>

      {/* Partner Zone - demoted to bottom */}
      <section id="partners" className="mt-16 pt-8 border-t border-base-300/30">
        <div className="max-w-6xl mx-auto px-4 pb-8">
          <AffiliateHub destination={destination} />
        </div>
      </section>
    </DashboardShell>
  );
}

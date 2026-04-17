/**
 * CityHub — City-level destination page.
 * Detailed decision support: safety snapshot, neighbourhood guidance,
 * accommodation, getting around, arrival checklist, after-dark, AI Q&A.
 */

import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api from '../lib/api';
import Loading from '../components/Loading';
import SEO from '../components/SEO';
import DashboardShell from '../components/dashboard/DashboardShell';
import DestinationTrustStrip from '../components/destinations/DestinationTrustStrip';
import DestinationChat from '../components/DestinationChat';
import PlanGate from '../components/PlanGate';
import Button from '../components/Button';
import TravelAdvisoryBanner from '../components/destinations/TravelAdvisoryBanner';
import Skeleton from '../components/Skeleton';
import {
  MapPin, ShieldCheck, AlertTriangle, Globe, ArrowLeft, CheckCircle,
  ExternalLink, Sparkles, Sun, Moon, Navigation, BookmarkPlus, Plus
} from 'lucide-react';
import { useNavigate as useNav } from 'react-router-dom';
import { toast } from 'react-hot-toast';

function parseTags(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try { return JSON.parse(raw); } catch { return []; }
}

const SAFETY_COLORS = {
  high: 'border-emerald-500/20 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400',
  medium: 'border-yellow-500/20 bg-yellow-500/5 text-yellow-600',
  low: 'border-red-500/20 bg-red-500/5 text-red-600',
};

export default function CityHub() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [destination, setDestination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const fetchDestination = async () => {
      try {
        setLoading(true);
        const res = await api.get(`/destinations/by-slug/${slug}`);
        const data = res.data.data;
        if (data.destination_level === 'country') {
          navigate(`/destinations/countries/${slug}`, { replace: true });
          return;
        }
        setDestination(data);
        setError(null);
      } catch (err) {
        setError('City not found.');
      } finally {
        setLoading(false);
      }
    };
    fetchDestination();
  }, [slug, navigate]);

  const handleSave = async () => {
    try {
      await api.post(`/destinations/${destination.id}/save`);
      setSaved(true);
      toast.success('Destination saved!');
    } catch (err) {
      toast.error('Failed to save destination');
    }
  };

  if (loading) return (
    <DashboardShell>
      {/* Skeleton hero */}
      <div className="skeleton h-64 md:h-72 w-full rounded-none" />
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        {/* Breadcrumb + title */}
        <div className="space-y-3">
          <Skeleton className="h-3 w-48" />
          <Skeleton className="h-8 w-72" />
          <Skeleton className="h-4 w-full max-w-xl" />
          <Skeleton className="h-4 w-4/5 max-w-xl" />
        </div>
        {/* Main 3-column grid */}
        <div className="grid md:grid-cols-3 gap-8">
          <div className="md:col-span-2 space-y-6">
            <Skeleton className="h-40 rounded-xl" />
            <Skeleton className="h-32 rounded-xl" />
            <Skeleton className="h-48 rounded-xl" />
          </div>
          <div className="space-y-4">
            <Skeleton className="h-56 rounded-xl" />
            <Skeleton className="h-36 rounded-xl" />
          </div>
        </div>
      </div>
    </DashboardShell>
  );
  if (error || !destination) {
    return (
      <DashboardShell>
        <div className="max-w-2xl mx-auto py-20 text-center space-y-4">
          <p className="text-4xl">🏙</p>
          <p className="text-xl font-black">{error || 'City not found'}</p>
          <Link to="/destinations" className="text-brand-vibrant underline text-sm">Back to destinations</Link>
        </div>
      </DashboardShell>
    );
  }

  const {
    name, title, description, image_url, country, region_name,
    advisory_stance, advisory_summary, advisory_checked_at, fcdo_slug,
    safety_rating, safety_intelligence, emergency_contacts,
    solo_fit_tags, best_for_tags, highlights = [],
    short_summary, why_solo_travellers, ideal_trip_length,
    neighbourhood_shortlist, arrival_tips,
    content_blocks = {}, parent_country,
  } = destination;

  const displayName = title || name;
  const soloTags = parseTags(solo_fit_tags);
  const bestForTags = parseTags(best_for_tags);
  const highlightsList = typeof highlights === 'string' ? JSON.parse(highlights || '[]') : (highlights || []);
  const safetyColor = SAFETY_COLORS[safety_rating] || '';

  return (
    <DashboardShell>
      <SEO
        title={`${displayName} — Solo Travel City Guide`}
        description={description?.slice(0, 160) || `Solo travel guide for ${displayName}.`}
      />

      {/* Trust strip */}
      <DestinationTrustStrip destination={destination} />

      {/* Hero */}
      <div className="relative h-60 md:h-72 overflow-hidden bg-base-200">
        {image_url ? (
          <img src={image_url} alt={`${displayName} cityscape`} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-base-300 to-base-200 flex items-center justify-center">
            <MapPin size={48} className="text-base-content/20" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-base-100 via-base-100/40 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-6">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-xs text-base-content/60 mb-2">
            <Link to="/destinations" className="hover:text-brand-vibrant transition-colors">Destinations</Link>
            {parent_country && (
              <>
                <span>/</span>
                <Link to={`/destinations/countries/${parent_country.slug || ''}`} className="hover:text-brand-vibrant transition-colors">
                  {parent_country.title || parent_country.name}
                </Link>
              </>
            )}
            <span>/</span>
            <span className="text-base-content/80">{displayName}</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <span className="px-2.5 py-1 rounded-lg bg-brand-vibrant/10 border border-brand-vibrant/20 text-brand-vibrant text-xs font-black uppercase tracking-widest flex items-center gap-1.5">
              <MapPin size={11} /> City Guide
            </span>
            {country && (
              <span className="px-2.5 py-1 rounded-lg bg-black/50 backdrop-blur-sm text-white text-xs font-medium">{country}</span>
            )}
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-base-content tracking-tight">{displayName}</h1>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8 space-y-10">
        {/* Advisory warning */}
        <TravelAdvisoryBanner
          advisoryStance={advisory_stance}
          advisorySummary={advisory_summary}
          advisoryCheckedAt={advisory_checked_at}
          fcdoSlug={fcdo_slug}
          dismissable
        />

        <div className="grid md:grid-cols-3 gap-8">
          {/* Main content */}
          <div className="md:col-span-2 space-y-8">
            {/* Should I consider this? - Tactical summary block */}
            {(short_summary || why_solo_travellers || bestForTags.length > 0) && (
              <section className="p-5 rounded-xl bg-brand-vibrant/5 border border-brand-vibrant/15">
                <h2 className="text-base font-black text-brand-vibrant mb-3 flex items-center gap-2">
                  <Sparkles size={16} /> Should I consider this?
                </h2>
                {short_summary && (
                  <p className="text-base-content/80 leading-relaxed text-sm mb-3">{short_summary}</p>
                )}
                {why_solo_travellers && (
                  <p className="text-base-content/70 leading-relaxed text-sm mb-3">{why_solo_travellers}</p>
                )}
                {bestForTags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {bestForTags.map(tag => (
                      <span key={tag} className="px-2.5 py-1 rounded-lg bg-brand-vibrant/10 text-brand-vibrant text-xs font-bold border border-brand-vibrant/20">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </section>
            )}
            {/* Overview + suitability */}
            <section>
              <h2 className="text-lg font-black text-base-content mb-3">About {displayName}</h2>
              {description && <p className="text-base-content/70 leading-relaxed">{description}</p>}
              {content_blocks.solo_suitability && (
                <div className="mt-4 p-5 rounded-xl bg-brand-vibrant/5 border border-brand-vibrant/15">
                  <h3 className="text-sm font-black uppercase tracking-widest text-brand-vibrant mb-2 flex items-center gap-2">
                    <Sparkles size={14} /> Is this city right for you?
                  </h3>
                  <p className="text-sm text-base-content/70 leading-relaxed whitespace-pre-wrap">
                    {content_blocks.solo_suitability.content}
                  </p>
                  <p className="text-xs text-base-content/40 mt-3">✦ AI-assisted research</p>
                </div>
              )}
            </section>

            {/* Safety brief */}
            {(content_blocks.safety_brief || safety_intelligence) && (
              <section className="p-6 rounded-xl bg-base-200 border border-base-300/50">
                <h2 className="text-base font-black text-base-content mb-3 flex items-center gap-2">
                  <ShieldCheck size={18} className="text-brand-vibrant" /> Safety Overview
                </h2>
                {content_blocks.safety_brief && (
                  <div className="text-sm text-base-content/70 leading-relaxed whitespace-pre-wrap mb-4">
                    {content_blocks.safety_brief.content}
                  </div>
                )}
                {safety_intelligence && (
                  <p className="text-sm text-base-content/60 leading-relaxed">{safety_intelligence}</p>
                )}
                {fcdo_slug && (
                  <a href={`https://www.gov.uk/foreign-travel-advice/${fcdo_slug}`} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 mt-3 text-xs text-brand-vibrant font-bold hover:underline">
                    <ExternalLink size={12} /> Official FCDO advisory
                  </a>
                )}
                <p className="text-xs text-base-content/40 mt-4">✦ AI-assisted research — verify with FCDO</p>
              </section>
            )}

            {/* Where to stay - Neighbourhood shortlist */}
            {neighbourhood_shortlist && (
              <section className="p-5 rounded-xl bg-base-200 border border-base-300/50">
                <h2 className="text-base font-black text-base-content mb-4 flex items-center gap-2">
                  <MapPin size={16} className="text-brand-vibrant" /> Where to stay
                </h2>
                <div className="space-y-3">
                  {neighbourhood_shortlist.map((n, idx) => (
                    <div key={idx} className="p-3 rounded-lg bg-base-100 border border-base-300/50">
                      <p className="text-sm font-bold text-base-content mb-1">{n.area}</p>
                      <p className="text-xs text-base-content/60">{n.why_good}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* First 24 hours */}
            {(arrival_tips || content_blocks.arrival_checklist) && (
              <section className="p-5 rounded-xl bg-brand-vibrant/5 border border-brand-vibrant/15">
                <h2 className="text-base font-black text-brand-vibrant mb-3 flex items-center gap-2">
                  <Sun size={16} /> Your first 24 hours
                </h2>
                {arrival_tips && (
                  <p className="text-sm text-base-content/70 leading-relaxed mb-3">{arrival_tips}</p>
                )}
                {content_blocks.arrival_checklist && (
                  <div className="text-sm text-base-content/70 leading-relaxed whitespace-pre-wrap">{content_blocks.arrival_checklist.content}</div>
                )}
              </section>
            )}

            {/* Arrival checklist */}
            {content_blocks.arrival_checklist && (
              <section className="p-5 rounded-xl bg-base-200 border border-base-300/50">
                <h2 className="text-base font-black text-base-content mb-3 flex items-center gap-2">
                  <CheckCircle size={16} className="text-brand-vibrant" /> Arrival Checklist
                </h2>
                <div className="text-sm text-base-content/70 leading-relaxed whitespace-pre-wrap">
                  {content_blocks.arrival_checklist.content}
                </div>
                <p className="text-xs text-base-content/40 mt-3">✦ AI-assisted research — verify locally</p>
              </section>
            )}

            {/* After dark */}
            {content_blocks.after_dark && (
              <section>
                <h2 className="text-lg font-black text-base-content mb-3 flex items-center gap-2">
                  <Moon size={18} className="text-brand-vibrant" /> After Dark
                </h2>
                <div className="text-sm text-base-content/70 leading-relaxed whitespace-pre-wrap">
                  {content_blocks.after_dark.content}
                </div>
                <p className="text-xs text-base-content/40 mt-3">✦ AI-assisted research</p>
              </section>
            )}

            {/* Friction points */}
            {content_blocks.friction_points && (
              <section>
                <h2 className="text-lg font-black text-base-content mb-3">Common friction points</h2>
                <div className="text-sm text-base-content/70 leading-relaxed whitespace-pre-wrap">
                  {content_blocks.friction_points.content}
                </div>
                <p className="text-xs text-base-content/40 mt-3">✦ AI-assisted research</p>
              </section>
            )}

            {/* Highlights */}
            {highlightsList.length > 0 && (
              <section>
                <h2 className="text-lg font-black text-base-content mb-3">Highlights</h2>
                <ul className="grid sm:grid-cols-2 gap-2">
                  {highlightsList.map((h, i) => (
                    <li key={i} className="flex items-start gap-2.5 p-3 rounded-xl bg-base-200 border border-base-300/50 text-sm text-base-content/70">
                      <CheckCircle size={14} className="text-brand-vibrant flex-shrink-0 mt-0.5" />
                      {h}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* AI Q&A */}
            <PlanGate
              minPlan="navigator"
              title={`Ask Atlas about ${displayName}`}
              description="Upgrade to Navigator to get AI-powered answers about safety, transport, food, and culture in this city."
            >
              <DestinationChat destinationId={destination.id} destinationName={displayName} destinationLevel="city" />
            </PlanGate>
          </div>

          {/* Right column */}
          <div className="space-y-5">
            {/* Safety snapshot */}
            <div className="p-5 rounded-xl bg-base-200 border border-base-300/50 space-y-3">
              <h3 className="text-xs font-black uppercase tracking-widest text-base-content/50">Safety snapshot</h3>
              {safety_rating && (
                <div className={`px-3 py-2 rounded-xl border text-sm font-bold flex items-center gap-2 ${safetyColor}`}>
                  <ShieldCheck size={14} />
                  {safety_rating === 'high' ? 'Generally safe' : safety_rating === 'medium' ? 'Exercise caution' : 'High caution'}
                </div>
              )}
              {fcdo_slug && (
                <a href={`https://www.gov.uk/foreign-travel-advice/${fcdo_slug}`} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs text-brand-vibrant font-bold hover:underline">
                  <ExternalLink size={11} /> FCDO advisory
                </a>
              )}
            </div>

            {/* Emergency contacts */}
            {emergency_contacts && Object.keys(emergency_contacts).length > 0 && (
              <div className="p-5 rounded-xl bg-base-200 border border-base-300/50 space-y-3">
                <h3 className="text-xs font-black uppercase tracking-widest text-base-content/50">Emergency</h3>
                {Object.entries(emergency_contacts).map(([type, number]) => (
                  <div key={type} className="flex items-center justify-between">
                    <span className="text-xs text-base-content/50 font-medium capitalize">{type}</span>
                    <span className="font-black text-base-content text-sm">{number}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Best-for tags */}
            {bestForTags.length > 0 && (
              <div className="p-5 rounded-xl bg-base-200 border border-base-300/50 space-y-2">
                <h3 className="text-xs font-black uppercase tracking-widest text-base-content/50">Best for</h3>
                <div className="flex flex-wrap gap-1.5">
                  {bestForTags.map(tag => (
                    <span key={tag} className="px-2.5 py-1 rounded-lg bg-base-100 text-base-content/60 text-xs font-bold border border-base-300/50">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* CTAs */}
            <button
              onClick={handleSave}
              disabled={saved}
              className={`flex items-center justify-center gap-2 w-full py-3 rounded-xl border font-bold text-sm transition-all ${
                saved
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600'
                  : 'bg-base-200 border-base-300/50 text-base-content/70 hover:border-brand-vibrant/40 hover:text-brand-vibrant'
              }`}
            >
              <BookmarkPlus size={16} />
              {saved ? 'Saved!' : 'Save destination'}
            </button>

            <Link
              to={`/trips/new?destination=${encodeURIComponent(displayName)}`}
              className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-brand-vibrant text-white font-black text-sm transition-all hover:bg-brand-vibrant/90 hover:shadow-lg hover:shadow-brand-vibrant/20"
            >
              <Sparkles size={16} /> Start trip here
            </Link>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}

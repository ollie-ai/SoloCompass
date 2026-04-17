import { useState, useEffect, useMemo } from 'react';
import { Search, ChevronDown, HelpCircle, MessageSquare } from 'lucide-react';
import * as Accordion from '@radix-ui/react-accordion';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import SEO from '../components/SEO';
import Skeleton from '../components/Skeleton';

const DEFAULT_FAQS = [
  {
    category: 'Getting Started',
    items: [
      { q: 'What is SoloCompass?', a: 'SoloCompass is an all-in-one travel planning platform built specifically for solo travellers. It combines AI-powered itinerary generation, real-time safety data, scheduled check-ins, and buddy matching in one place.' },
      { q: 'Is SoloCompass free?', a: 'Yes! The Explorer plan is completely free and includes trip planning, destination guides, travel advisories, and 1 AI itinerary per month. Guardian and Navigator plans unlock unlimited AI, scheduled check-ins, and more.' },
      { q: 'How does the Travel DNA quiz work?', a: 'It\'s a 60-second quiz that asks about your travel style, budget, social preferences, and adventure level. Your results personalise every itinerary and help us match you with compatible travel buddies.' },
      { q: 'Which countries are covered?', a: 'SoloCompass covers destinations worldwide. We provide safety scores, local tips, accommodation guidance, and AI itineraries for hundreds of cities across every continent.' },
    ]
  },
  {
    category: 'Safety & Check-ins',
    items: [
      { q: 'How do scheduled check-ins work?', a: 'You set a check-in time. If you don\'t check in by then, SoloCompass alerts your emergency contacts. On the Guardian plan, check-ins can be set to repeat automatically throughout your trip.' },
      { q: 'What happens when I activate SOS?', a: 'Your emergency contacts receive an immediate notification with your last known location and a message that you need help. The Guardian plan also enables a direct call option to your contacts.' },
      { q: 'Who are emergency contacts?', a: 'These are trusted people (family, friends) you add in your settings. They don\'t need to have SoloCompass — they receive SMS or email alerts when you miss a check-in or activate SOS.' },
      { q: 'Is my location stored?', a: 'Only when you choose to share it (during check-in or SOS). We don\'t continuously track your location. You control exactly when location data is used.' },
    ]
  },
  {
    category: 'Billing & Subscriptions',
    items: [
      { q: 'How do I upgrade my plan?', a: 'Go to Settings → Billing & Subscription → choose your plan. Payments are processed securely via Stripe. You can cancel at any time.' },
      { q: 'Can I cancel my subscription?', a: 'Yes, cancel any time from Settings → Billing. You\'ll retain access until the end of your billing period, then revert to the free Explorer plan.' },
      { q: 'Do you offer refunds?', a: 'We offer refunds within 7 days of a new subscription if you haven\'t substantially used the premium features. Contact us at support@solocompass.co.uk for refund requests.' },
      { q: 'What payment methods are accepted?', a: 'We accept all major credit and debit cards (Visa, Mastercard, Amex) via Stripe. Apple Pay and Google Pay are also supported on compatible devices.' },
    ]
  },
  {
    category: 'Privacy & Data',
    items: [
      { q: 'How is my data used?', a: 'Your data is used only to provide and improve the SoloCompass service. We never sell your data to third parties. See our Privacy Policy for full details.' },
      { q: 'Can I export my data?', a: 'Yes. Go to Settings → Billing & Data → Export my data. You\'ll receive a JSON archive of all your trips, check-ins, and profile data within minutes.' },
      { q: 'How do I delete my account?', a: 'Go to Settings → Billing & Data → Danger Zone → Delete Account. This permanently removes all your data within 30 days. We recommend downloading your data export first.' },
    ]
  }
];

export default function FAQ() {
  const [query, setQuery] = useState('');
  const [faqs, setFaqs] = useState(DEFAULT_FAQS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFaqs = async () => {
      try {
        const res = await api.get('/help/faqs');
        const raw = res.data?.data || res.data?.faqs || res.data;
        if (Array.isArray(raw) && raw.length > 0) {
          setFaqs(raw);
        }
      } catch {
        // Fall back to defaults
      } finally {
        setLoading(false);
      }
    };
    fetchFaqs();
  }, []);

  const filtered = useMemo(() => {
    if (!query.trim()) return faqs;
    const q = query.toLowerCase();
    return faqs
      .map((cat) => ({
        ...cat,
        items: cat.items?.filter(
          (item) => item.q?.toLowerCase().includes(q) || item.a?.toLowerCase().includes(q)
        ) || [],
      }))
      .filter((cat) => cat.items.length > 0);
  }, [faqs, query]);

  return (
    <div className="min-h-screen bg-base-200 pt-20 pb-16">
      <SEO
        title="FAQ — Frequently Asked Questions"
        description="Find answers to the most common questions about SoloCompass — plans, safety, privacy, and more."
      />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-10">
          <span className="inline-block px-4 py-1.5 bg-brand-vibrant/10 text-brand-vibrant text-sm font-bold rounded-full mb-5">
            Support
          </span>
          <h1 className="text-4xl font-black text-base-content mb-3">Frequently Asked Questions</h1>
          <p className="text-base-content/60 max-w-xl mx-auto">
            Can't find what you're looking for? <Link to="/contact" className="text-primary hover:underline">Contact us</Link> and we'll help.
          </p>
        </div>

        {/* Search */}
        <div className="relative mb-8">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-base-content/40 pointer-events-none" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search FAQ…"
            className="w-full pl-11 pr-4 py-3 bg-base-100 border border-base-300 rounded-xl text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            aria-label="Search FAQ"
          />
        </div>

        {/* Content */}
        {loading ? (
          <div className="space-y-4" aria-busy="true">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 bg-base-100 rounded-2xl border border-base-300/50">
            <HelpCircle size={36} className="mx-auto mb-4 text-base-content/30" aria-hidden="true" />
            <p className="font-semibold text-base-content/70">No results for "{query}"</p>
            <p className="text-sm text-base-content/40 mt-1">Try a different search term or <Link to="/contact" className="text-primary hover:underline">contact us</Link>.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {filtered.map((cat) => (
              <section key={cat.category} aria-labelledby={`faq-cat-${cat.category}`}>
                <h2
                  id={`faq-cat-${cat.category}`}
                  className="text-xs font-black uppercase tracking-widest text-base-content/40 mb-3 px-1"
                >
                  {cat.category}
                </h2>
                <Accordion.Root type="multiple" className="bg-base-100 rounded-2xl border border-base-300/50 shadow-sm overflow-hidden divide-y divide-base-200/60">
                  {cat.items.map((item, idx) => (
                    <Accordion.Item key={`${cat.category}-${idx}`} value={`${cat.category}-${idx}`}>
                      <Accordion.Header>
                        <Accordion.Trigger className="group w-full flex items-center justify-between gap-4 px-5 py-4 text-left text-sm font-semibold text-base-content hover:bg-base-200/50 transition-colors focus:outline-none focus:bg-base-200/50">
                          <span>{item.q}</span>
                          <ChevronDown size={16} className="shrink-0 text-base-content/40 transition-transform duration-200 group-data-[state=open]:rotate-180" aria-hidden="true" />
                        </Accordion.Trigger>
                      </Accordion.Header>
                      <Accordion.Content className="overflow-hidden data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up">
                        <p className="px-5 pb-4 text-sm text-base-content/70 leading-relaxed">{item.a}</p>
                      </Accordion.Content>
                    </Accordion.Item>
                  ))}
                </Accordion.Root>
              </section>
            ))}
          </div>
        )}

        {/* CTA */}
        <div className="mt-12 bg-base-100 rounded-2xl border border-base-300/50 p-8 text-center shadow-sm">
          <MessageSquare size={28} className="mx-auto mb-3 text-brand-vibrant" aria-hidden="true" />
          <h2 className="text-lg font-black text-base-content mb-2">Still have questions?</h2>
          <p className="text-sm text-base-content/60 mb-5">Our support team usually responds within 1-2 business days.</p>
          <Link
            to="/contact"
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-brand-vibrant text-white text-sm font-bold rounded-xl hover:opacity-90 transition-opacity focus:outline-none focus:ring-2 focus:ring-brand-vibrant/50"
          >
            Contact Support
          </Link>
        </div>
      </div>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import * as Accordion from '@radix-ui/react-accordion';
import { ChevronDown, Mail, Book, Shield, User, CreditCard, MapPin, AlertTriangle, ArrowRight, Search, Lock, Globe, Star, HelpCircle, Video } from 'lucide-react';
import api from '../lib/api';
import { trackEvent } from '../lib/telemetry';
import SEO from '../components/SEO';
import StatusPage from '../components/StatusPage';

// Map API string icon names → Lucide components
const ICON_MAP = {
  User, Shield, CreditCard, MapPin, Lock, Globe, Star, HelpCircle, Mail, Book
};
const resolveIcon = (icon) => {
  if (!icon) return HelpCircle;
  if (typeof icon === 'string') return ICON_MAP[icon] || HelpCircle;
  return icon; // Already a component reference
};

const DEFAULT_GUIDES = [
  {
    id: 'guide-1',
    category: 'Getting Started',
    title: 'Set up your first trip in 5 minutes',
    duration: '5 min',
    steps: [
      'Sign up or log in to your SoloCompass account',
      'Click "New Trip" and enter your destination and dates',
      'Let AI generate a personalised daily itinerary',
      'Add emergency contacts in the Safety tab',
      'You\'re ready to go — check in when you arrive!',
    ],
  },
  {
    id: 'guide-2',
    category: 'Safety',
    title: 'Configure safety check-ins',
    duration: '3 min',
    steps: [
      'Open your trip and go to the Safety tab',
      'Add at least one emergency contact (name + phone)',
      'Set your check-in interval (e.g. every 12 hours)',
      'Enable SMS alerts so contacts are notified if you miss a check-in',
      'Use the SOS slider for immediate emergency escalation',
    ],
  },
  {
    id: 'guide-3',
    category: 'Planning',
    title: 'Customise your AI itinerary',
    duration: '4 min',
    steps: [
      'After AI generates your itinerary, click any day to expand it',
      'Drag activities to reorder them',
      'Click an activity to edit name, time, location or cost',
      'Add custom activities with the "+ Add" button',
      'Use the Budget Tracker tab to track your spending',
    ],
  },
  {
    id: 'guide-4',
    category: 'Community',
    title: 'Find a travel buddy',
    duration: '3 min',
    steps: [
      'Go to the Buddies page from the navigation',
      'Complete your Travel DNA profile if you haven\'t already',
      'Browse the Discovery tab for travellers heading to similar destinations',
      'Send a connection request and introduce yourself',
      'Once connected, you can share trip details via the Messages page',
    ],
  },
];

const DEFAULT_TUTORIALS = [
  {
    id: 'tutorial-1',
    title: 'Getting started with SoloCompass',
    duration: '3:12',
    url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  },
  {
    id: 'tutorial-2',
    title: 'Safety check-ins & SOS walkthrough',
    duration: '2:45',
    url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  },
  {
    id: 'tutorial-3',
    title: 'AI itinerary generation',
    duration: '4:30',
    url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  },
];

const Help = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [faqs, setFaqs] = useState([]);
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    trackEvent('page_view', { page: 'help' });
    const fetchHelpContent = async () => {
      try {
        setLoading(true);
        const [faqResponse, articlesResponse] = await Promise.all([api.get('/help/faqs'), api.get('/help/articles')]);
        const response = faqResponse;
        if (response.data?.data) {
          setFaqs(response.data.data);
        } else if (response.data?.faqs) {
          setFaqs(response.data.faqs);
        } else if (Array.isArray(response.data)) {
          setFaqs(response.data);
        }
        if (articlesResponse.data?.data) {
          setArticles(articlesResponse.data.data);
        }
      } catch (err) {
        console.error('Failed to fetch Help Center data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchHelpContent();
  }, []);

  const defaultFaqs = [
    {
      category: 'Getting Started',
      icon: User,
      questions: [
        { q: "How do I get started with SoloCompass?", a: "Sign up for free, take the Travel DNA quiz (60 seconds), then create your first trip. Our AI will generate a personalised itinerary based on your preferences." },
        { q: "Is SoloCompass free?", a: "Yes. The free tier includes trip planning, destination guides, FCDO travel alerts, and 1 AI itinerary per month. Upgrade to Guardian or Navigator for unlimited AI, scheduled check-ins, and more." },
        { q: "What is the Travel DNA quiz?", a: "A quick quiz that calibrates SoloCompass to your travel style — adventure level, social preference, budget, and interests. It's used to personalise itineraries and buddy matching." },
      ]
    },
    {
      category: 'Account & Security',
      icon: Shield,
      questions: [
        { q: "How do I reset my password?", a: "Click 'Forgot Password' on the login page and enter your email. We'll send a secure reset link within a few minutes." },
        { q: "Is my data secure?", a: "We use industry-standard encryption, secure cookies, and JWT authentication. We never store passwords in plain text and are GDPR compliant." },
        { q: "How do I delete my account?", a: "Go to Settings > Billing & Data > Danger Zone > Delete Account. This permanently removes all your data within 30 days. We recommend downloading your data archive first." },
        { q: "Can I export my data?", a: "Yes. Go to Settings > Billing & Data > Data Portability and click 'Download my data archive'. This includes your trips, itineraries, safety settings, and profile information." },
      ]
    },
    {
      category: 'Billing & Subscription',
      icon: CreditCard,
      questions: [
        { q: "What features are included in the free tier?", a: "Basic trip planning, destination safety information, 1 AI itinerary per month, trip history, and manual check-ins." },
        { q: "How do I cancel my subscription?", a: "Go to Settings > Billing & Data > Current Plan > Cancel subscription. Your premium features continue until the end of your billing period." },
        { q: "Can I switch plans?", a: "Yes. You can upgrade or downgrade at any time from Settings > Billing & Data. Changes take effect at your next billing cycle." },
        { q: "Do you offer refunds?", a: "Refunds are available within 7 days of purchase. Contact support@solocompass.co.uk with your order details." },
      ]
    },
    {
      category: 'Trips & Safety',
      icon: MapPin,
      questions: [
        { q: "How do safety check-ins work?", a: "Set check-in intervals in your trip's safety settings. You'll receive reminders at each interval. If you miss a check-in, SoloCompass escalates: reminder → grace period → alert to your emergency contacts. You can cancel escalation at any point." },
        { q: "How accurate are AI itineraries?", a: "AI itineraries are based on travel data and your preferences, but may not reflect real-time conditions. Always verify opening hours, prices, and safety info directly with providers." },
        { q: "What travel advisory data do you use?", a: "We integrate official UK FCDO travel advisories. These are informational only — always check official government travel advice before and during your trips." },
        { q: "Does SoloCompass guarantee my safety?", a: "No. SoloCompass provides planning tools and safety workflows, but it cannot guarantee outcomes. Always follow local laws and official advice. For emergencies, contact local emergency services first." },
      ]
    },
    {
      category: 'Travel Buddies',
      icon: User,
      questions: [
        { q: "How does buddy matching work?", a: "SoloCompass matches you with travellers heading to similar destinations at overlapping times, based on Travel DNA compatibility and shared interests." },
        { q: "Is buddy matching safe?", a: "You control what information is visible. You can block or report any user. We recommend meeting in public places and sharing your plans with someone you trust." },
        { q: "Why am I not seeing any matches?", a: "Matches require destination overlap, date overlap, and a completed Travel Profile. Try creating a trip, completing your profile, and searching for specific destinations." },
      ]
    },
  ];

  const displayFaqs = loading ? [] : (faqs.length > 0 ? faqs : defaultFaqs);

  const filteredFaqs = searchQuery
    ? displayFaqs.map(section => ({
        ...section,
        questions: section.questions.filter(
          q => q.q.toLowerCase().includes(searchQuery.toLowerCase()) || q.a.toLowerCase().includes(searchQuery.toLowerCase())
        )
      })).filter(section => section.questions.length > 0)
    : displayFaqs;

  const normalizedSearch = searchQuery.toLowerCase();
  const filteredGuides = normalizedSearch
    ? guides.filter((guide) => `${guide.title} ${guide.category} ${(guide.steps || []).join(' ')}`.toLowerCase().includes(normalizedSearch))
    : guides;
  const filteredTutorials = normalizedSearch
    ? tutorials.filter((tutorial) => `${tutorial.title} ${tutorial.duration}`.toLowerCase().includes(normalizedSearch))
    : tutorials;

  const handleContactClick = (method) => {
    trackEvent('contact_support', { method });
  };

  const handleFeedbackSubmit = async (e) => {
    e.preventDefault();
    if (!feedback.rating || !feedback.message.trim()) return;
    try {
      setSubmittingFeedback(true);
      await api.post('/help/feedback', feedback);
      setFeedback({ rating: 0, message: '', email: '', screenshotName: '', screenshotDataUrl: '' });
    } catch (err) {
      console.error('Failed to submit feedback:', err);
    } finally {
      setSubmittingFeedback(false);
    }
  };

  const handleScreenshotChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setFeedback((prev) => ({
        ...prev,
        screenshotName: file.name,
        screenshotDataUrl: String(reader.result || ''),
      }));
    };
    reader.readAsDataURL(file);
  };

  return (
    <>
      <SEO 
        title="Help Center - SoloCompass" 
        description="Get help with SoloCompass. Find answers to common questions about trips, safety, billing, and more."
      />
      
      <div className="min-h-screen bg-mesh pt-20 pb-24 lg:pb-20">
        <div className="max-w-4xl mx-auto px-4 py-16">
          {/* Hero */}
          <div className="text-center mb-12 relative z-10">
            <span className="inline-block px-4 py-1.5 bg-brand-vibrant/10 text-brand-vibrant text-xs font-black uppercase tracking-[0.2em] rounded-full mb-6 border border-brand-vibrant/20">
              Support Center
            </span>
            <h1 className="text-4xl lg:text-7xl font-black text-base-content tracking-tight mb-3 font-outfit uppercase">
              How can we help?
            </h1>
            <p className="text-base-content/60 text-lg max-w-md mx-auto font-medium font-inter">
              Find answers to common questions or get in touch with our mission control.
            </p>

            {/* Search */}
            <div className="mt-8 max-w-md mx-auto relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-base-content/40" size={18} />
              <input
                type="text"
                placeholder="Search help articles..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-11 pr-4 py-3 rounded-xl border border-base-300 text-sm font-medium text-base-content/80 outline-none focus:ring-2 focus:ring-brand-vibrant/20 focus:border-brand-vibrant bg-base-100"
              />
            </div>
          </div>

          {/* Quick Links */}
          <div className="grid md:grid-cols-3 gap-4 mb-12">
            <Link to="/safety-info" className="group">
              <div className="glass-card p-6 rounded-xl text-center hover:shadow-lg hover:shadow-brand-vibrant/10 transition-all">
                <div className="w-12 h-12 bg-success/10 rounded-xl flex items-center justify-center text-success mx-auto mb-4 group-hover:scale-110 transition-transform">
                  <Shield size={24} />
                </div>
                <h3 className="font-bold text-base-content mb-1">Safety Help</h3>
                <p className="text-sm text-base-content/60">Check-ins, contacts, SOS</p>
              </div>
            </Link>
            
            <Link to="/docs" className="group">
              <div className="glass-card p-6 rounded-xl text-center hover:shadow-lg hover:shadow-brand-vibrant/10 transition-all">
                <div className="w-12 h-12 bg-brand-vibrant/10 rounded-xl flex items-center justify-center text-brand-vibrant mx-auto mb-4 group-hover:scale-110 transition-transform">
                  <Book size={24} />
                </div>
                <h3 className="font-bold text-base-content mb-1">Quick Start Guide</h3>
                <p className="text-sm text-base-content/60">Get set up in 5 minutes</p>
              </div>
            </Link>

            <a 
              href="mailto:support@solocompass.co.uk" 
              onClick={() => handleContactClick('email')}
              className="group"
            >
              <div className="glass-card p-6 rounded-xl text-center hover:shadow-lg hover:shadow-brand-vibrant/10 transition-all">
                <div className="w-12 h-12 bg-brand-vibrant/10 rounded-xl flex items-center justify-center text-brand-vibrant mx-auto mb-4 group-hover:scale-110 transition-transform">
                  <Mail size={24} />
                </div>
                <h3 className="font-bold text-base-content mb-1">Contact Support</h3>
                <p className="text-sm text-base-content/60">We reply within 1-2 business days</p>
              </div>
            </a>
          </div>

          {articles.length > 0 && (
            <div className="mb-12">
              <h2 className="text-xl font-black mb-4">Help articles</h2>
              <div className="grid md:grid-cols-2 gap-4">
                {articles.map((article) => (
                  <div key={article.id} className="glass-card p-5 rounded-xl">
                    <p className="text-xs uppercase tracking-wider text-brand-vibrant font-bold mb-1">{article.category}</p>
                    <h3 className="font-bold text-base-content mb-2">{article.title}</h3>
                    <p className="text-sm text-base-content/70">{article.summary}</p>
                    {article.updatedAt && (
                      <p className="mt-3 text-xs text-base-content/40 font-medium">
                        Updated {new Date(article.updatedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Emergency guidance */}
          <div className="mb-12 p-5 bg-warning/10 border border-warning/30 rounded-xl">
            <div className="flex items-start gap-3">
              <AlertTriangle className="text-warning shrink-0 mt-0.5" size={20} />
              <div>
                <p className="font-bold text-warning text-sm mb-1">Emergency guidance</p>
                <p className="text-sm text-warning font-medium">
                  SoloCompass support cannot replace local emergency services. For urgent emergencies, contact local emergency services first (112 in Europe, 911 in the US, 999 in the UK).
                </p>
              </div>
            </div>
          </div>

          {/* Getting Started Guides */}
          {filteredGuides.length > 0 && (
            <div className="mb-12">
              <h2 className="text-2xl font-black text-base-content mb-4">Getting started guides</h2>
              <div className="grid md:grid-cols-2 gap-4">
                {filteredGuides.map((guide) => (
                  <div key={guide.id} className="glass-card rounded-xl p-5 border border-base-300/60">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-black uppercase tracking-widest text-brand-vibrant">{guide.category}</span>
                      <span className="text-xs text-base-content/50">{guide.duration}</span>
                    </div>
                    <h3 className="font-bold text-base-content mb-3">{guide.title}</h3>
                    <ul className="space-y-1 text-sm text-base-content/60">
                      {(guide.steps || []).map((step, idx) => <li key={`${guide.id}-step-${idx}`}>• {step}</li>)}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Video tutorials */}
          {filteredTutorials.length > 0 && (
            <div className="mb-12">
              <h2 className="text-2xl font-black text-base-content mb-4">Video tutorials</h2>
              <div className="grid md:grid-cols-3 gap-4">
                {filteredTutorials.map((tutorial) => (
                  <a key={tutorial.id} href={tutorial.url} target="_blank" rel="noreferrer" className="glass-card rounded-xl p-5 border border-base-300/60 hover:border-brand-vibrant/30 transition-colors group">
                    <div className="w-10 h-10 bg-brand-vibrant/10 rounded-xl flex items-center justify-center text-brand-vibrant mb-3 group-hover:scale-110 transition-transform">
                      <Video size={18} />
                    </div>
                    <h3 className="font-bold text-base-content mb-1">{tutorial.title}</h3>
                    <p className="text-sm text-base-content/50">{tutorial.duration}</p>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* FAQ Accordion */}
          <Accordion.Root type="multiple" className="space-y-4">
            {filteredFaqs.length > 0 ? filteredFaqs.map((section) => {
              const Icon = resolveIcon(section.icon);
              return (
                <Accordion.Item 
                  key={section.category} 
                  value={section.category}
                  className="glass-card rounded-xl overflow-hidden"
                >
                  <Accordion.Header>
                    <Accordion.Trigger className="flex items-center gap-3 w-full p-6 text-left group">
                      <div className="w-10 h-10 bg-brand-vibrant/10 rounded-lg flex items-center justify-center text-brand-vibrant flex-shrink-0">
                        {React.createElement(Icon, { size: 20 })}
                      </div>
                      <h2 className="text-xl font-bold text-base-content flex-1">{section.category}</h2>
                      <ChevronDown size={20} className="text-base-content/40 transition-transform group-data-[state=open]:rotate-180" />
                    </Accordion.Trigger>
                  </Accordion.Header>
                  <Accordion.Content className="overflow-hidden data-[state=open]:animate-slide-down data-[state=closed]:animate-slide-up">
                    <div className="px-6 pb-6 space-y-4">
                      {section.questions.map((item, idx) => (
                        <Accordion.Item key={idx} value={`${section.category}-${idx}`} className="border-l-2 border-base-300/50 pl-5">
                          <Accordion.Header>
                            <Accordion.Trigger className="text-left w-full group">
                              <h3 className="font-semibold text-base-content mb-2 group-data-[state=open]:text-brand-vibrant transition-colors">
                                {item.q}
                              </h3>
                            </Accordion.Trigger>
                          </Accordion.Header>
                          <Accordion.Content>
                            <p className="text-base-content/60 leading-relaxed text-sm">{item.a}</p>
                          </Accordion.Content>
                        </Accordion.Item>
                      ))}
                    </div>
                  </Accordion.Content>
                </Accordion.Item>
              );
            }) : (
              <div className="text-center py-12">
                <p className="text-base-content/60 font-medium">No results found for "{searchQuery}"</p>
                <button onClick={() => setSearchQuery('')} className="mt-3 text-brand-vibrant font-bold text-sm hover:underline">
                  Clear search
                </button>
              </div>
            )}
          </Accordion.Root>

          {/* Feedback form */}
          <div className="mt-16 p-8 bg-base-100 rounded-2xl border border-base-300">
            <h3 className="text-xl font-black text-base-content mb-4">Send product feedback</h3>
            <form onSubmit={handleFeedbackSubmit} className="space-y-4">
              <div>
                <p className="text-sm font-bold text-base-content mb-2">Rating</p>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((value) => (
                    <button type="button" key={`rating-${value}`} onClick={() => setFeedback((prev) => ({ ...prev, rating: value }))}>
                      <Star size={20} className={value <= feedback.rating ? 'text-amber-500 fill-amber-500' : 'text-base-300'} />
                    </button>
                  ))}
                </div>
              </div>
              <textarea
                value={feedback.message}
                onChange={(e) => setFeedback((prev) => ({ ...prev, message: e.target.value }))}
                rows={4}
                placeholder="What should we improve?"
                className="w-full px-4 py-3 rounded-xl border border-base-300 bg-base-100"
                required
              />
              <input
                type="email"
                value={feedback.email}
                onChange={(e) => setFeedback((prev) => ({ ...prev, email: e.target.value }))}
                placeholder="Email (optional)"
                className="w-full px-4 py-3 rounded-xl border border-base-300 bg-base-100"
              />
              <div>
                <input type="file" accept="image/*" onChange={handleScreenshotChange} className="file-input file-input-bordered w-full" />
                {feedback.screenshotName && <p className="text-xs text-base-content/50 mt-1">Attached: {feedback.screenshotName}</p>}
              </div>
              <button type="submit" disabled={submittingFeedback} className="btn-brand rounded-xl">
                {submittingFeedback ? 'Sending...' : 'Submit feedback'}
              </button>
            </form>
          </div>

          {/* Contact Support Block */}
          <div className="mt-16 p-8 bg-base-200 rounded-2xl border border-base-300 text-center">
            <h3 className="text-xl font-black text-base-content mb-2">Still need help?</h3>
            <p className="text-base-content/60 font-medium mb-6 max-w-md mx-auto">
              Our support team aims to reply within 1-2 business days.
            </p>
            <a 
              href="mailto:support@solocompass.co.uk"
              onClick={() => handleContactClick('footer_email')}
              className="btn-brand btn-lg rounded-xl font-bold gap-2"
            >
              Email Support <ArrowRight size={20} />
            </a>
          </div>

          {/* System status */}
          <div className="mt-8">
            <StatusPage />
          </div>

          <div className="mt-16 pt-8 border-t border-base-300/50">
            <div className="flex flex-wrap justify-center gap-6 text-sm text-base-content/40">
              <Link to="/terms" className="hover:text-base-content transition-colors">Terms of Service</Link>
              <Link to="/privacy" className="hover:text-base-content transition-colors">Privacy Policy</Link>
              <Link to="/cookies" className="hover:text-base-content transition-colors">Cookie Policy</Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Help;

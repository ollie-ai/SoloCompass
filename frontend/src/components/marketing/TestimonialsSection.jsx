import { useEffect, useMemo, useState } from 'react';
import { Star, ChevronLeft, ChevronRight } from 'lucide-react';
import api from '../../lib/api';

const FALLBACK_TESTIMONIALS = [
  { id: 'fallback-1', author: { name: 'Solo Traveler' }, destination: 'Lisbon', title: 'Confident from day one', content: 'SoloCompass made my planning calm and organized. The daily structure and safety tools were exactly what I needed.', overallRating: 5 },
  { id: 'fallback-2', author: { name: 'City Explorer' }, destination: 'Tokyo', title: 'Perfect for first-time solo trips', content: 'I loved how quickly I could go from idea to a workable itinerary, then customize every day myself.', overallRating: 5 },
  { id: 'fallback-3', author: { name: 'Frequent Flyer' }, destination: 'Porto', title: 'Planning and safety in one place', content: 'The combination of advisories, checklist, and itinerary editing saved me hours and reduced stress.', overallRating: 4 },
];

const TestimonialsSection = () => {
  const [testimonials, setTestimonials] = useState(FALLBACK_TESTIMONIALS);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const loadTestimonials = async () => {
      try {
        const response = await api.get('/reviews', { params: { limit: 9, sort: 'highest' } });
        const reviews = response?.data?.data?.reviews || [];
        if (reviews.length > 0) {
          setTestimonials(reviews);
        }
      } catch {
        // Keep fallback testimonials
      }
    };
    loadTestimonials();
  }, []);

  useEffect(() => {
    if (testimonials.length <= 1) return undefined;
    const timer = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % testimonials.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [testimonials.length]);

  const active = useMemo(() => testimonials[activeIndex] || testimonials[0], [testimonials, activeIndex]);

  const move = (direction) => {
    if (!testimonials.length) return;
    setActiveIndex((prev) => (prev + direction + testimonials.length) % testimonials.length);
  };

  return (
    <section className="py-20 bg-base-200/40">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-black text-base-content">Traveler testimonials</h2>
          <p className="text-base-content/60 mt-2">Real feedback from solo travelers using SoloCompass.</p>
        </div>

        {active && (
          <div className="bg-base-100 border border-base-300 rounded-2xl p-8 shadow-sm">
            <div className="flex items-center gap-1 mb-4">
              {Array.from({ length: 5 }).map((_, idx) => (
                <Star key={`star-${idx}`} size={16} className={idx < (active.overallRating || 0) ? 'text-amber-500 fill-amber-500' : 'text-base-300'} />
              ))}
            </div>
            <h3 className="text-xl font-black text-base-content mb-2">{active.title || 'Great solo travel companion'}</h3>
            <p className="text-base-content/70 leading-relaxed mb-6">“{active.content}”</p>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-bold text-base-content">{active.author?.name || 'SoloCompass user'}</p>
                <p className="text-sm text-base-content/50">{active.destination || 'Solo trip'}</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => move(-1)} className="w-9 h-9 rounded-lg border border-base-300 hover:bg-base-200 flex items-center justify-center">
                  <ChevronLeft size={16} />
                </button>
                <button onClick={() => move(1)} className="w-9 h-9 rounded-lg border border-base-300 hover:bg-base-200 flex items-center justify-center">
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default TestimonialsSection;

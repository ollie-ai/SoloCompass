import SEO from '../components/SEO';
import FeedbackForm from '../components/FeedbackForm';

export default function Support() {
  return (
    <div className="min-h-screen bg-base-200 pt-20 pb-16">
      <SEO title="Support - SoloCompass" description="Contact support and share product feedback with rating and screenshots." />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-black text-base-content mb-3">Support</h1>
          <p className="text-base-content/60">Tell us what’s working and where we can improve.</p>
        </div>
        <div className="bg-base-100 rounded-2xl p-6 shadow-sm border border-base-300/50">
          <FeedbackForm />
        </div>
      </div>
    </div>
  );
}

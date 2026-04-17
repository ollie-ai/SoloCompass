import { Mail, Phone, MapPin, Clock, MessageSquare } from 'lucide-react';
import SEO from '../components/SEO';
import FeedbackForm from '../components/FeedbackForm';

export default function Contact() {
  return (
    <div className="min-h-screen bg-base-200 pt-20 pb-16">
      <SEO title="Contact Us" description="Get in touch with the SoloCompass team for support, partnerships, or general enquiries." />
      
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <span className="inline-block px-4 py-1.5 bg-brand-vibrant/10 text-brand-vibrant text-sm font-bold rounded-full mb-6">
            Contact
          </span>
          <h1 className="text-4xl font-black text-base-content mb-4">Contact SoloCompass</h1>
          <p className="text-lg text-base-content/60 max-w-2xl mx-auto">
            Have a question or need help? We aim to respond within 1-2 business days.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-6">
            <div className="bg-base-100 rounded-2xl p-6 shadow-sm border border-base-300/50">
              <h2 className="text-xl font-black text-base-content mb-6">Get in Touch</h2>
              
              <div className="space-y-4">
                <a href="mailto:support@solocompass.co.uk" className="flex items-center gap-4 p-4 rounded-xl bg-base-200 hover:bg-brand-vibrant/5 transition-colors group">
                  <div className="w-10 h-10 rounded-xl bg-brand-vibrant/10 text-brand-vibrant flex items-center justify-center group-hover:bg-brand-vibrant group-hover:text-white transition-colors">
                    <Mail size={20} />
                  </div>
                  <div>
                    <p className="text-sm text-base-content/60 font-bold">Email</p>
                    <p className="font-bold text-base-content">support@solocompass.co.uk</p>
                  </div>
                </a>

                <div className="flex items-center gap-4 p-4 rounded-xl bg-base-200">
                  <div className="w-10 h-10 rounded-xl bg-brand-vibrant/10 text-brand-vibrant flex items-center justify-center">
                    <Phone size={20} />
                  </div>
                  <div>
                    <p className="text-sm text-base-content/60 font-bold">Phone</p>
                    <p className="font-bold text-base-content">+44 (0) 20 7946 0958</p>
                  </div>
                </div>

                <div className="flex items-center gap-4 p-4 rounded-xl bg-base-200">
                  <div className="w-10 h-10 rounded-xl bg-brand-vibrant/10 text-brand-vibrant flex items-center justify-center">
                    <MapPin size={20} />
                  </div>
                  <div>
                    <p className="text-sm text-base-content/60 font-bold">Address</p>
                    <p className="font-bold text-base-content">London, United Kingdom</p>
                  </div>
                </div>

                <div className="flex items-center gap-4 p-4 rounded-xl bg-base-200">
                  <div className="w-10 h-10 rounded-xl bg-brand-vibrant/10 text-brand-vibrant flex items-center justify-center">
                    <Clock size={20} />
                  </div>
                  <div>
                    <p className="text-sm text-base-content/60 font-bold">Support Hours</p>
                    <p className="font-bold text-base-content">Mon-Fri, 9:00-17:00 GMT</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-error/10 rounded-2xl p-6 border border-error/20">
              <h3 className="text-lg font-black text-error mb-2 flex items-center gap-2">
                <MessageSquare size={20} /> Emergency Support
              </h3>
              <p className="text-sm text-error font-medium">
                If you are experiencing a safety emergency while traveling, use the SOS button in the app or contact local emergency services immediately.
              </p>
            </div>
          </div>

          <div className="bg-base-100 rounded-2xl p-6 shadow-sm border border-base-300/50">
            <h2 className="text-xl font-black text-base-content mb-6">Send Feedback</h2>
            <FeedbackForm />
          </div>
        </div>
      </div>
    </div>
  );
}

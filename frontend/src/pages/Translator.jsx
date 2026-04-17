import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import SEO from '../components/SEO';
import TranslationTool from '../components/TranslationTool';

export default function Translator() {
  const navigate = useNavigate();

  return (
    <>
      <SEO
        title="Quick Translator - SoloCompass"
        description="Quickly translate essential phrases while traveling abroad."
      />

      <div className="min-h-screen bg-base-100 pt-20 pb-12">
        <div className="max-w-2xl mx-auto px-4 py-8">
          <button
            onClick={() => navigate('/safety')}
            className="flex items-center gap-2 text-base-content/60 hover:text-base-content mb-6 transition-colors"
          >
            <ArrowLeft size={18} />
            <span className="text-sm font-medium">Back to Safety</span>
          </button>

          <TranslationTool />
        </div>
      </div>
    </>
  );
}

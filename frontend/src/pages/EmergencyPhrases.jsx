import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { 
  ArrowLeft, AlertTriangle, Globe, AlertOctagon
} from 'lucide-react';
import SEO from '../components/SEO';
import PhraseList from '../components/PhraseList';

export default function EmergencyPhrases() {
  const navigate = useNavigate();
  const [languages, setLanguages] = useState([]);
  const [selectedLanguage, setSelectedLanguage] = useState(null);
  const [phrases, setPhrases] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copiedPhrase, setCopiedPhrase] = useState(null);
  const [playing, setPlaying] = useState(null);

  useEffect(() => {
    fetchLanguages();
  }, []);

  const fetchLanguages = async () => {
    try {
      const res = await api.get('/emergency/phrases');
      if (res.data.success) {
        setLanguages(res.data.data.languages || []);
      }
    } catch (err) {
      console.error('Failed to fetch languages:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchPhrases = async (languageCode) => {
    try {
      const res = await api.get(`/emergency/phrases?language=${languageCode}`);
      if (res.data.success) {
        setPhrases(res.data.data.phrases);
      }
    } catch (err) {
      console.error('Failed to fetch phrases:', err);
    }
  };

  const handleLanguageSelect = (lang) => {
    setSelectedLanguage(lang);
    fetchPhrases(lang.code);
  };

  const handleCopy = async (key, text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedPhrase(key);
      setTimeout(() => setCopiedPhrase(null), 2000);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  };

  const handleSpeak = (text) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.8;
      window.speechSynthesis.speak(utterance);
    }
  };

  const phraseKeys = [
    { key: 'help', label: 'Help!' },
    { key: 'police', label: 'I need the police' },
    { key: 'ambulance', label: 'I need an ambulance' },
    { key: 'hospital', label: 'I need to go to a hospital' },
    { key: 'lost', label: 'I am lost' },
    { key: 'danger', label: 'I am in danger' },
    { key: 'thief', label: 'I have been robbed' },
    { key: 'emergency', label: 'EMERGENCY' }
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-base-100 pt-20">
        <div className="max-w-2xl mx-auto px-4 py-8">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-base-300 rounded w-32"></div>
            <div className="h-4 bg-base-300 rounded w-48"></div>
            <div className="grid grid-cols-2 gap-3 mt-8">
              {[1,2,3,4,5,6].map(i => (
                <div key={i} className="h-16 bg-base-300 rounded-xl"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <SEO 
        title="Emergency Phrases - SoloCompass" 
        description="Essential emergency phrases translated in multiple languages for solo travelers."
      />
      
      <div className="min-h-screen bg-base-100 pt-20 pb-12">
        <div className="max-w-2xl mx-auto px-4 py-8">
          {/* Header */}
          <button 
            onClick={() => navigate('/safety')}
            className="flex items-center gap-2 text-base-content/60 hover:text-base-content mb-6 transition-colors"
          >
            <ArrowLeft size={18} />
            <span className="text-sm font-medium">Back to Safety</span>
          </button>

          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-warning/10 rounded-xl flex items-center justify-center">
                <AlertTriangle className="text-warning" size={20} />
              </div>
              <h1 className="text-2xl font-black text-base-content">Emergency Phrases</h1>
            </div>
            <p className="text-base-content/60 text-sm">
              Key phrases to use in emergencies. Select a language to see translations.
            </p>
          </div>

          {/* Language Selector */}
          {!selectedLanguage ? (
            <div>
              <h2 className="text-sm font-bold text-base-content/80 mb-3 uppercase tracking-wide">Select Language</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {languages.map((lang) => (
                  <button
                    key={lang.code}
                    onClick={() => handleLanguageSelect(lang)}
                    className="p-4 bg-base-200 hover:bg-base-300 rounded-xl transition-colors text-left"
                  >
                    <div className="flex items-center gap-2">
                      <Globe size={16} className="text-brand-vibrant" />
                      <span className="font-bold text-base-content text-sm">{lang.name}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div>
              {/* Language Header */}
              <div className="flex items-center justify-between mb-6">
                <button
                  onClick={() => {
                    setSelectedLanguage(null);
                    setPhrases(null);
                  }}
                  className="flex items-center gap-2 text-base-content/60 hover:text-base-content transition-colors"
                >
                  <Globe size={16} />
                  <span className="text-sm font-medium">{selectedLanguage?.name}</span>
                </button>
                <button
                  onClick={() => handleLanguageSelect(selectedLanguage)}
                  className="text-sm text-brand-vibrant hover:underline"
                >
                  Change
                </button>
              </div>

              {/* Phrases List */}
              <PhraseList
                phrases={phraseKeys.map(({ key, label }) => ({ key, label, text: phrases?.[key] || '...' }))}
                copiedKey={copiedPhrase}
                onCopy={handleCopy}
                onSpeak={handleSpeak}
              />

              {/* Emergency Note */}
              <div className="mt-8 p-4 bg-error/10 border border-error/20 rounded-xl">
                <div className="flex items-start gap-3">
                  <AlertOctagon className="text-error shrink-0 mt-0.5" size={18} />
                  <div>
                    <p className="font-bold text-error text-sm">In a real emergency</p>
                    <p className="text-base-content/80 text-sm mt-1">
                      If possible, call local emergency services directly. These phrases are meant to help you communicate when you cannot reach emergency services.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

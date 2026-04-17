import { useState, useEffect, useRef } from 'react';
import { X, Send, Sparkles, Zap, Shield, Compass, MapPin } from 'lucide-react';
import api from '../lib/api';
import toast from 'react-hot-toast';
import { useAuthStore } from '../stores/authStore';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import AtlasMessage from './atlas/AtlasMessage';
import AtlasTypingIndicator from './atlas/AtlasTypingIndicator';
import AtlasSuggestionChips from './atlas/AtlasSuggestionChips';
import AtlasChatBubble from './atlas/AtlasChatBubble';

const AIChat = () => {
  const { isAuthenticated } = useAuthStore();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'assistant', content: "Hello! I'm Atlas, your SoloCompass travel assistant. How can I help you stay safe and inspired today?" }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [quickPrompts, setQuickPrompts] = useState([
    { label: "Safe walk near me", icon: MapPin },
    { label: "Emergency numbers", icon: Shield },
    { label: "Local solo-tips", icon: Sparkles },
    { label: "Safety Score", icon: Zap }
  ]);
  const [promptsLoading, setPromptsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    const openAtlas = () => setIsOpen(true);
    window.addEventListener('atlas:open', openAtlas);
    return () => window.removeEventListener('atlas:open', openAtlas);
  }, []);

  const isPublicPage = ['/', '/login', '/register', '/about', '/features', '/safety-info', '/help', '/terms', '/privacy'].includes(location.pathname);
  const showBottomNav = isAuthenticated && !isPublicPage && isMobile;
  const bottomOffset = showBottomNav ? 'bottom-[calc(4rem+env(safe-area-inset-bottom,0px)+0.5rem)]' : 'bottom-[calc(1.5rem+env(safe-area-inset-bottom,0px))]';
  const horizontalPos = isMobile ? 'left-4' : 'right-6';
  const horizontalChatPos = isMobile ? 'left-4 right-4' : 'right-6';

  useEffect(() => {
    if (!isAuthenticated) return;

    const fetchQuickPrompts = async () => {
      try {
        setPromptsLoading(true);
        const response = await api.get('/ai/quick-prompts');
        if (response.data?.data && Array.isArray(response.data.data)) {
          const iconMap = {
            destinations: MapPin,
            safety: Shield,
            budget: Zap,
            social: Sparkles,
            packing: Sparkles,
            planning: MapPin,
          };
          const mapped = response.data.data.map(p => ({
            label: p.text || p.label || p.question || '',
            icon: iconMap[p.category] || Sparkles,
          })).filter(p => p.label);
          if (mapped.length > 0) {
            setQuickPrompts(mapped);
          }
        }
      } catch (err) {
      } finally {
        setPromptsLoading(false);
      }
    };

    fetchQuickPrompts();
  }, [isAuthenticated]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (text = input) => {
    if (!text.trim()) return;

    const userMessage = { role: 'user', content: text };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const response = await api.post('/ai/chat', { message: text });
      const assistantMessage = { role: 'assistant', content: response.data.data?.response || response.data.data?.reply || 'Sorry, I could not process that request.' };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      toast.error('Failed to connect to Atlas');
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, I encountered an error. Please try again.' }]);
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthenticated) return null;

  if (!isOpen) {
    return (
      <AtlasChatBubble
        bottomOffset={bottomOffset}
        horizontalPos={horizontalPos}
        onClick={() => setIsOpen(true)}
      />
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      className={`fixed ${bottomOffset} ${horizontalChatPos} z-[100] w-[calc(100vw-2rem)] sm:w-[340px] lg:w-[380px] h-[520px] lg:h-[580px] bg-base-100 rounded-2xl shadow-[0_30px_100px_rgba(0,0,0,0.25)] border border-base-300/50 flex flex-col overflow-hidden`}
    >
      {/* Header */}
      <div className="p-4 bg-gradient-to-r from-slate-900 to-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-brand-vibrant to-emerald-500 rounded-xl flex items-center justify-center shadow-lg">
            <Compass size={20} className="text-white" />
          </div>
          <div>
            <h4 className="font-black text-white text-sm tracking-tight">Atlas</h4>
            <div className="flex items-center gap-1.5">
               <span className="w-2 h-2 bg-success/100 rounded-full animate-pulse"></span>
               <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">Online</span>
            </div>
          </div>
        </div>
        <button 
          onClick={() => setIsOpen(false)} 
          className="p-2 hover:bg-base-100/10 rounded-xl transition-colors text-base-content/40 hover:text-white"
        >
          <X size={20} />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-base-200/50">
        <AnimatePresence>
          {messages.map((msg, i) => (
            <AtlasMessage key={`msg-${i}`} message={msg} />
          ))}
        </AnimatePresence>
        
        {loading && <AtlasTypingIndicator />}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Prompts */}
      <div className="px-4 py-2 border-t border-base-300/50 bg-base-100">
        <AtlasSuggestionChips
          prompts={quickPrompts}
          loading={promptsLoading}
          onSelect={handleSend}
        />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-base-300/50 bg-base-100">
        <div className="relative flex items-center">
          <input 
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSend(); }}
            placeholder="Ask Atlas anything..."
            className="w-full pl-4 pr-14 py-3 bg-base-200 rounded-xl border-none outline-none focus:ring-2 focus:ring-brand-vibrant/30 focus:bg-base-100 transition-all font-medium text-sm"
          />
          <motion.button 
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => handleSend()}
            disabled={!input.trim() || loading}
            className="absolute right-2 w-9 h-9 bg-brand-vibrant text-white rounded-lg flex items-center justify-center shadow-lg shadow-brand-vibrant/20 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
             <Send size={16} />
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
};

export default AIChat;

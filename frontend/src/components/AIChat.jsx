import { useState, useEffect, useRef } from 'react';
import { MessageCircle, X, Send, Sparkles, Zap, Shield, Compass, User, MapPin, Smile } from 'lucide-react';
import api from '../lib/api';
import toast from 'react-hot-toast';
import { useAuthStore } from '../stores/authStore';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import DOMPurify from 'dompurify';

const UserIcon = User;

const formatMessage = (content, isUser) => {
  if (!content) return '';
  
  const textColor = isUser ? 'text-white' : 'text-base-content';
  const boldColor = isUser ? 'text-white' : 'text-base-content';
  const subColor = isUser ? 'text-emerald-100' : 'text-base-content/80';
  
  const sections = [];
  const paragraphs = content.split(/\n\n+/);
  
  paragraphs.forEach((paragraph, paraIndex) => {
    const lines = paragraph.split('\n');
    let hasSection = false;
    
    lines.forEach((line, lineIndex) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      
      const boldHeaderMatch = trimmed.match(/^\*\*(.+?)\*\*[:\-]?\s*(.*)$/);
      if (boldHeaderMatch) {
        hasSection = true;
        sections.push(
          <p key={`sec-${paraIndex}-${lineIndex}`} className={`font-bold mt-4 mb-2 text-base ${boldColor}`}>
            {boldHeaderMatch[1]}
            {boldHeaderMatch[2] && <span className={`font-normal ${subColor} text-sm ml-1`}>{boldHeaderMatch[2]}</span>}
          </p>
        );
        return;
      }
      
      const headingMatch = trimmed.match(/^(#{1,3})\s+(.+)$/);
      if (headingMatch) {
        hasSection = true;
        const level = headingMatch[1].length;
        const classes = level === 1 ? `font-bold ${textColor} mt-5 mb-2` : 
                       level === 2 ? `font-semibold ${textColor} mt-4 mb-1.5` : 
                       `font-medium ${subColor} mt-3 mb-1 uppercase tracking-wide`;
        sections.push(<p key={`h-${paraIndex}-${lineIndex}`} className={classes}>{headingMatch[2]}</p>);
        return;
      }
      
      const bulletMatch = trimmed.match(/^[•\-\*]\s+(.+)$/);
      if (bulletMatch) {
        sections.push(
          <li key={`li-${paraIndex}-${lineIndex}`} className={`ml-4 list-disc list-inside mb-1.5 ${isUser ? 'text-emerald-50' : 'text-base-content/80'}`}>
            {bulletMatch[1]}
          </li>
        );
        return;
      }
      
      const numberMatch = trimmed.match(/^(\d+)\.\s+(.+)$/);
      if (numberMatch) {
        sections.push(
          <li key={`num-${paraIndex}-${lineIndex}`} className={`ml-4 list-decimal list-inside mb-1.5 ${isUser ? 'text-emerald-50' : 'text-base-content/80'}`}>
            {numberMatch[2]}
          </li>
        );
        return;
      }
      
      const boldMatch = trimmed.match(/\*\*(.+?)\*\*/g);
      let displayText = trimmed;
      if (boldMatch) {
        boldMatch.forEach(bold => {
          const boldContent = bold.replace(/\*\*/g, '');
          displayText = displayText.replace(bold, `<strong class="font-bold ${boldColor}">${boldContent}</strong>`);
        });
      }
      
      if (displayText !== trimmed) {
        sections.push(
          <p key={`b-${paraIndex}-${lineIndex}`} className={`mb-2 ${isUser ? 'text-emerald-50' : 'text-base-content/80'}`} dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(displayText) }} />
        );
        return;
      }
      
      sections.push(
        <p key={`p-${paraIndex}-${lineIndex}`} className={`mb-2 ${isUser ? 'text-emerald-50' : 'text-base-content/80'} ${hasSection ? 'ml-2' : ''}`}>
          {trimmed}
        </p>
      );
    });
  });
  
  return sections;
};

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
      <motion.button 
        onClick={() => setIsOpen(true)}
        className={`fixed ${bottomOffset} ${horizontalPos} z-[90] w-12 h-12 lg:w-14 lg:h-14 bg-brand-vibrant text-white rounded-full flex items-center justify-center shadow-lg hover:shadow-xl hover:shadow-brand-vibrant/40 transition-all group`}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
         <Sparkles size={20} className="group-hover:rotate-12 transition-transform" />
      </motion.button>
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
      <div role="log" aria-live="polite" aria-label="Chat messages" className="flex-1 overflow-y-auto p-4 space-y-4 bg-base-200/50">
        <AnimatePresence>
          {messages.map((msg, i) => (
            <motion.div 
              key={`msg-${i}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`flex items-start gap-2 max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  msg.role === 'user' 
                    ? 'bg-gradient-to-br from-brand-vibrant to-brand-accent' 
                    : 'bg-base-300 border border-base-300'
                }`}>
                  {msg.role === 'user' ? (
                    <User size={14} className="text-white" />
                  ) : (
                    <Smile size={14} className="text-base-content/80" />
                  )}
                </div>
                <div className={`p-3 rounded-2xl text-sm font-medium leading-relaxed ${
                  msg.role === 'user' 
                    ? 'bg-success/100 text-white rounded-br-md shadow-lg' 
                    : 'bg-base-100 border border-base-300 text-base-content rounded-bl-md shadow-sm'
                }`}>
                  {formatMessage(msg.content, msg.role === 'user')}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        
        {loading && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex justify-start"
          >
            <div className="flex items-start gap-2">
              <div className="w-7 h-7 rounded-lg bg-base-300 border border-base-300 flex items-center justify-center">
                <Smile size={14} className="text-base-content/80" />
              </div>
              <div className="bg-base-100 border border-base-300 p-3 rounded-2xl rounded-bl-md shadow-sm flex gap-1">
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
              </div>
            </div>
          </motion.div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Prompts */}
      <div className="px-4 py-2 border-t border-base-300/50 bg-base-100">
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {promptsLoading ? (
            <div className="flex gap-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={`skeleton-prompt-${i}`} className="px-3 py-2 rounded-xl bg-base-200 animate-pulse h-8 w-20 flex-shrink-0"></div>
              ))}
            </div>
          ) : quickPrompts.slice(0, 4).map((p, i) => (
            <motion.button 
              key={`prompt-${i}`}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleSend(p.label)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-base-200 hover:bg-brand-vibrant/10 hover:text-brand-vibrant text-base-content/80 text-[11px] font-bold uppercase tracking-wide whitespace-nowrap transition-all border border-base-300/50 flex-shrink-0"
            >
              <p.icon size={12} /> {p.label}
            </motion.button>
          ))}
        </div>
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

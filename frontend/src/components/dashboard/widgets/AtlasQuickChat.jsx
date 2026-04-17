import { useState, useRef, useEffect } from 'react';
import { Sparkles, Send, Loader2, ExternalLink, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../../lib/api';

const QUICK_SUGGESTIONS = [
  'Best destinations for solo women',
  'Safety tips for night travel',
  'Budget travel hacks',
];

function Message({ msg }) {
  const isUser = msg.role === 'user';
  return (
    <div className={`flex gap-2 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center shrink-0 mt-0.5">
          <Sparkles size={12} className="text-white" />
        </div>
      )}
      <div
        className={`max-w-[85%] px-3 py-2 rounded-xl text-sm leading-relaxed ${
          isUser
            ? 'bg-primary text-white rounded-tr-sm'
            : 'bg-base-200 text-base-content rounded-tl-sm'
        }`}
      >
        {msg.content}
      </div>
    </div>
  );
}

export default function AtlasQuickChat({ className = '' }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (text) => {
    const trimmed = (text || input).trim();
    if (!trimmed || loading) return;

    const userMsg = { role: 'user', content: trimmed };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await api.post('/ai/chat', { message: trimmed });
      const reply = res.data?.message || res.data?.response || res.data?.content || 'Sorry, I couldn\'t get a response right now.';
      setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'I\'m unable to respond right now. Please try again later.',
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const showSuggestions = messages.length === 0;

  return (
    <div className={`dashboard-widget flex flex-col ${className}`}>
      <div className="dashboard-widget-header">
        <div className="dashboard-widget-title">
          <Sparkles size={18} className="text-brand-vibrant" />
          <h3>Atlas AI</h3>
        </div>
        <Link
          to="/dashboard"
          className="flex items-center gap-1 text-xs font-bold text-brand-vibrant hover:text-brand-vibrant/80 transition-colors"
          aria-label="Open full Atlas chat"
        >
          Full chat <ExternalLink size={11} />
        </Link>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-3 py-2 max-h-48 scrollbar-none">
        {showSuggestions ? (
          <div className="space-y-2">
            <p className="text-xs text-base-content/40 font-medium mb-3">Quick questions:</p>
            {QUICK_SUGGESTIONS.map((suggestion, i) => (
              <button
                key={i}
                onClick={() => sendMessage(suggestion)}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-base-200 hover:bg-primary/10 hover:text-primary text-left text-xs font-medium text-base-content/70 transition-colors group"
              >
                <Zap size={12} className="shrink-0 text-primary/60 group-hover:text-primary transition-colors" />
                {suggestion}
              </button>
            ))}
          </div>
        ) : (
          <>
            {messages.map((msg, i) => <Message key={i} msg={msg} />)}
            {loading && (
              <div className="flex items-center gap-2 text-base-content/40">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center shrink-0">
                  <Sparkles size={12} className="text-white" />
                </div>
                <div className="flex gap-1">
                  {[0, 1, 2].map(i => (
                    <span key={i} className="w-1.5 h-1.5 rounded-full bg-base-content/30 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                  ))}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </>
        )}
      </div>

      {/* Input */}
      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-base-300/50">
        <input
          type="text"
          className="flex-1 bg-base-200 rounded-lg px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-base-content/30 text-base-content"
          placeholder="Ask Atlas anything…"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={loading}
        />
        <button
          onClick={() => sendMessage()}
          disabled={!input.trim() || loading}
          className="w-8 h-8 flex items-center justify-center rounded-lg bg-primary text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors shrink-0"
          aria-label="Send message"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
        </button>
      </div>
    </div>
  );
}

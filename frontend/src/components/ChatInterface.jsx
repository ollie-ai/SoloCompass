import { useRef } from 'react';
import PropTypes from 'prop-types';
import { ArrowLeft, Loader2, MessageCircle, Phone, Send, Video } from 'lucide-react';
import MessageBubble from './messages/MessageBubble';

function getInitials(name) {
  if (!name) return '?';
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
}

function formatDateHeader(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

function groupMessagesByDate(msgs) {
  const groups = {};
  msgs.forEach((msg) => {
    const date = new Date(msg.createdAt).toDateString();
    if (!groups[date]) groups[date] = [];
    groups[date].push(msg);
  });
  return groups;
}

/**
 * ChatInterface – reusable chat panel (message thread + input bar).
 * Extracted from Messages.jsx for standalone use.
 */
function ChatInterface({
  conversation,
  messages,
  messagesLoading,
  newMessage,
  sending,
  currentUserId,
  onBack,
  onSend,
  onMessageChange,
  onStartCall,
  messagesEndRef,
}) {
  const inputRef = useRef(null);
  const otherUser = conversation?.participants?.find((p) => p.id !== currentUserId)
    || conversation?.participant;

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend?.(e);
    }
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-base-100/50">
      {/* Header */}
      <div className="p-4 border-b border-base-300 flex items-center gap-3 bg-base-100 shrink-0">
        {onBack && (
          <button
            onClick={onBack}
            className="lg:hidden p-2 -ml-2 rounded-lg hover:bg-base-200 transition-colors"
          >
            <ArrowLeft size={20} className="text-base-content/60" />
          </button>
        )}

        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-vibrant/20 to-emerald-500/20 flex items-center justify-center shrink-0">
          {otherUser?.avatarUrl ? (
            <img src={otherUser.avatarUrl} alt={otherUser.name} className="w-10 h-10 rounded-xl object-cover" />
          ) : (
            <span className="text-sm font-black text-brand-vibrant">{getInitials(otherUser?.name)}</span>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-sm text-base-content truncate">{otherUser?.name || 'Unknown User'}</h3>
          {otherUser?.location && (
            <p className="text-xs text-base-content/50 truncate">{otherUser.location}</p>
          )}
        </div>

        {onStartCall && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => onStartCall(otherUser?.id, 'audio')}
              className="p-2.5 rounded-xl bg-brand-vibrant/10 text-brand-vibrant hover:bg-brand-vibrant/20 transition-colors"
              title="Audio call"
            >
              <Phone size={18} />
            </button>
            <button
              onClick={() => onStartCall(otherUser?.id, 'video')}
              className="p-2.5 rounded-xl bg-brand-vibrant/10 text-brand-vibrant hover:bg-brand-vibrant/20 transition-colors"
              title="Video call"
            >
              <Video size={18} />
            </button>
          </div>
        )}
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 min-h-0">
        {messagesLoading ? (
          <div className="flex flex-col items-center justify-center h-full text-base-content/30">
            <Loader2 size={24} className="animate-spin mb-2" />
            <p className="text-xs font-medium">Loading messages…</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="w-16 h-16 rounded-2xl bg-brand-vibrant/10 flex items-center justify-center mb-4">
              <MessageCircle size={28} className="text-brand-vibrant/40" />
            </div>
            <h4 className="font-bold text-base-content/60 mb-1">Start the conversation</h4>
            <p className="text-xs text-base-content/40 max-w-xs">
              Send a message to connect with {otherUser?.name || 'this traveler'}
            </p>
          </div>
        ) : (
          Object.entries(groupMessagesByDate(messages)).map(([date, msgs]) => (
            <div key={date}>
              <div className="flex items-center gap-4 my-6">
                <div className="flex-1 h-px bg-base-300/50" />
                <span className="text-[10px] font-bold text-base-content/40 uppercase tracking-widest">
                  {formatDateHeader(msgs[0]?.createdAt)}
                </span>
                <div className="flex-1 h-px bg-base-300/50" />
              </div>
              {msgs.map((message) => (
                <MessageBubble
                  key={message.id}
                  message={message}
                  isOwn={message.senderId === currentUserId}
                />
              ))}
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input bar */}
      <form onSubmit={onSend} className="p-4 border-t border-base-300 bg-base-100 shrink-0">
        <div className="flex items-end gap-3">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={newMessage}
              onChange={(e) => onMessageChange?.(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message…"
              rows={1}
              className="w-full px-4 py-3 rounded-xl bg-base-200 border-none text-sm font-medium text-base-content placeholder:text-base-content/40 focus:outline-none focus:ring-2 focus:ring-brand-vibrant/20 resize-none max-h-32"
              style={{ height: 'auto', minHeight: '48px' }}
            />
          </div>
          <button
            type="submit"
            disabled={!newMessage?.trim() || sending}
            className="p-3 rounded-xl bg-brand-vibrant text-white hover:bg-brand-vibrant/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
          >
            {sending ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
          </button>
        </div>
      </form>
    </div>
  );
}

ChatInterface.propTypes = {
  conversation: PropTypes.object,
  messages: PropTypes.array.isRequired,
  messagesLoading: PropTypes.bool,
  newMessage: PropTypes.string,
  sending: PropTypes.bool,
  currentUserId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onBack: PropTypes.func,
  onSend: PropTypes.func,
  onMessageChange: PropTypes.func,
  onStartCall: PropTypes.func,
  messagesEndRef: PropTypes.object,
};

export default ChatInterface;

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, Send, ArrowLeft, Search, Loader2, Phone, Video, PhoneOff, Clock, X } from 'lucide-react';
import api from '../lib/api';
import toast from 'react-hot-toast';
import { useAuthStore } from '../stores/authStore';
import DashboardShell from '../components/dashboard/DashboardShell';
import PageHeader from '../components/PageHeader';
import ConversationList from '../components/messages/ConversationList';
import MessageBubble from '../components/messages/MessageBubble';
import { useWebSocket } from '../hooks/useWebSocket';

const Messages = () => {
  const { user } = useAuthStore();
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showMobileList, setShowMobileList] = useState(true);
  const [callModalOpen, setCallModalOpen] = useState(false);
  const [callingUser, setCallingUser] = useState(null);
  const [callType, setCallType] = useState('audio');
  const { on, isConnected } = useWebSocket();
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    fetchConversations();
  }, []);

  useEffect(() => {
    if (selectedConversation) {
      fetchMessages(selectedConversation.id);
      markAsRead(selectedConversation.id);
    }
  }, [selectedConversation]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    const unsubscribe = on('buddy_message_new', (event) => {
      const incomingMessage = event?.message;
      const conversationId = Number(event?.conversationId);
      if (!incomingMessage || !conversationId) return;

      if (selectedConversation?.id === conversationId) {
        setMessages((prev) => {
          if (prev.some((msg) => msg.id === incomingMessage.id)) return prev;
          return [...prev, incomingMessage];
        });
        if (incomingMessage.senderId !== user?.id) {
          markAsRead(conversationId);
        }
      }

      setConversations((prev) => {
        const next = [...prev];
        const idx = next.findIndex((conv) => Number(conv.id) === conversationId);
        if (idx === -1) return prev;

        const target = next[idx];
        const unreadDelta =
          incomingMessage.senderId !== user?.id && selectedConversation?.id !== conversationId ? 1 : 0;
        next[idx] = {
          ...target,
          lastMessage: incomingMessage.content,
          lastMessageAt: incomingMessage.createdAt,
          unreadCount: (target.unreadCount || 0) + unreadDelta,
        };
        return next.sort((a, b) => new Date(b.lastMessageAt || 0) - new Date(a.lastMessageAt || 0));
      });
    });

    return () => unsubscribe?.();
  }, [on, selectedConversation?.id, user?.id]);

  const fetchConversations = async () => {
    setLoading(true);
    try {
      const response = await api.get('/messages/conversations');
      setConversations(response.data.data || []);
    } catch (error) {
      console.error('Failed to fetch conversations:', error);
      toast.error('Failed to load conversations');
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (conversationId) => {
    setMessagesLoading(true);
    try {
      const response = await api.get(`/messages/conversations/${conversationId}`);
      setMessages(response.data.data || []);
    } catch (error) {
      console.error('Failed to fetch messages:', error);
      toast.error('Failed to load messages');
    } finally {
      setMessagesLoading(false);
    }
  };

  const markAsRead = async (conversationId) => {
    try {
      await api.put(`/messages/conversations/${conversationId}/read`);
      setConversations(prev => prev.map(conv => 
        conv.id === conversationId ? { ...conv, unreadCount: 0 } : conv
      ));
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  };

  // Offline message queue helpers
  const QUEUE_KEY = 'solo_msg_queue';
  const getQueue = () => {
    try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]'); } catch { return []; }
  };
  const saveQueue = (q) => {
    try { localStorage.setItem(QUEUE_KEY, JSON.stringify(q)); } catch {}
  };
  const enqueue = (conversationId, content) => {
    const q = getQueue();
    q.push({ id: `tmp_${Date.now()}_${Math.random()}`, conversationId: String(conversationId), content, ts: Date.now() });
    saveQueue(q);
  };
  const dequeue = (tmpId) => {
    saveQueue(getQueue().filter((item) => item.id !== tmpId));
  };

  // Drain the offline queue when the component mounts / reconnects
  const drainQueue = async () => {
    const q = getQueue();
    if (q.length === 0) return;
    for (const item of q) {
      try {
        await api.post(`/messages/conversations/${item.conversationId}`, { content: item.content });
        dequeue(item.id);
      } catch {
        // Leave in queue for next attempt
        break;
      }
    }
  };

  // Drain on mount
  useEffect(() => {
    drainQueue();
  }, []);

  // Drain on WebSocket reconnect
  useEffect(() => {
    if (isConnected) {
      drainQueue();
    }
  }, [isConnected]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedConversation || sending) return;

    const content = newMessage.trim();
    setSending(true);

    // Optimistic local display
    const tmpMsg = {
      id: `tmp_${Date.now()}`,
      senderId: user?.id,
      senderName: user?.name,
      content,
      messageType: 'text',
      isRead: false,
      read: false,
      createdAt: new Date().toISOString(),
      _pending: true,
    };
    setMessages(prev => [...prev, tmpMsg]);
    setNewMessage('');

    try {
      const response = await api.post(`/messages/conversations/${selectedConversation.id}`, { content });
      
      // Replace optimistic msg with confirmed one
      setMessages(prev => prev.map(m => m.id === tmpMsg.id ? response.data.data : m));
      
      setConversations(prev => prev.map(conv => {
        if (conv.id === selectedConversation.id) {
          return { ...conv, lastMessage: response.data.data };
        }
        return conv;
      }).sort((a, b) => {
        const dateA = new Date(a.lastMessage?.createdAt || 0);
        const dateB = new Date(b.lastMessage?.createdAt || 0);
        return dateB - dateA;
      }));

      inputRef.current?.focus();
    } catch (error) {
      console.error('Failed to send message:', error);
      // Check if it's a plan limit error
      if (error.response?.data?.error?.code === 'MESSAGE_LIMIT_REACHED') {
        toast.error(error.response.data.error.message || 'Message limit reached. Upgrade to continue.');
      } else {
        // Offline – enqueue and show subtle notice
        enqueue(selectedConversation.id, content);
        toast('Message queued — will send when back online', { icon: '📬', duration: 4000 });
      }
      // Remove pending optimistic msg on hard failure (if limit reached, discard)
      if (error.response?.data?.error?.code === 'MESSAGE_LIMIT_REACHED') {
        setMessages(prev => prev.filter(m => m.id !== tmpMsg.id));
        setNewMessage(content);
      }
    } finally {
      setSending(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleStartCall = async (targetUserId, type) => {
    setCallingUser(targetUserId);
    setCallType(type);
    setCallModalOpen(true);
    
    try {
      const response = await api.post('/calls', {
        calleeId: targetUserId,
        type,
      });
      toast.success(`Calling...`);
    } catch (error) {
      console.error('Error starting call:', error);
      toast.error('Failed to start call');
      setCallModalOpen(false);
    }
  };

  const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const otherUser = selectedConversation?.participants?.find(p => p.id !== user?.id) 
    || selectedConversation?.participant;

  const filteredConversations = conversations.filter(conv => {
    if (!searchQuery) return true;
    const other = conv.participants?.find(p => p.id !== user?.id) || conv.participant;
    return other?.name?.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const formatDateHeader = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    
    return date.toLocaleDateString('en-US', { 
      weekday: 'long',
      month: 'long', 
      day: 'numeric' 
    });
  };

  const groupMessagesByDate = (msgs) => {
    const groups = {};
    msgs.forEach(msg => {
      const date = new Date(msg.createdAt).toDateString();
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(msg);
    });
    return groups;
  };

  return (
    <DashboardShell className="!px-0 !py-0">
      <div className="h-[calc(100vh-80px)] flex">
        <div className={`w-full lg:w-80 xl:w-96 border-r border-base-300 flex flex-col bg-base-100 ${
          !showMobileList && selectedConversation ? 'hidden lg:flex' : 'flex'
        }`}>
          <div className="p-4 border-b border-base-300">
            <PageHeader 
              title="Messages" 
              icon={MessageCircle}
              className="!mb-0"
            />
            
            <div className="relative mt-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40" size={16} />
              <input
                type="text"
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-base-200 border-none text-sm font-medium text-base-content placeholder:text-base-content/40 focus:outline-none focus:ring-2 focus:ring-brand-vibrant/20"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-12 text-base-content/30">
                <Loader2 size={24} className="animate-spin mb-2" />
                <p className="text-xs font-medium">Loading conversations...</p>
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                <div className="w-14 h-14 rounded-2xl bg-base-200 flex items-center justify-center mb-4">
                  <MessageCircle size={24} className="text-base-content/30" />
                </div>
                <h4 className="font-bold text-sm text-base-content/60 mb-1">
                  {searchQuery ? 'No results found' : 'No conversations yet'}
                </h4>
                <p className="text-xs text-base-content/40">
                  {searchQuery ? 'Try a different search term' : 'Connect with travelers to start messaging'}
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                {filteredConversations.map((conversation) => (
                  <ConversationList
                    key={conversation.id}
                    conversation={conversation}
                    isSelected={selectedConversation?.id === conversation.id}
                    onClick={() => {
                      setSelectedConversation(conversation);
                      setShowMobileList(false);
                    }}
                    currentUserId={user?.id}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        <div className={`flex-1 flex flex-col bg-base-100/50 ${
          showMobileList && selectedConversation ? 'hidden lg:flex' : 'flex lg:flex'
        }`}>
          {selectedConversation ? (
            <>
              <div className="p-4 border-b border-base-300 flex items-center gap-3 bg-base-100">
                <button
                  onClick={() => {
                    setShowMobileList(true);
                    setSelectedConversation(null);
                  }}
                  className="lg:hidden p-2 -ml-2 rounded-lg hover:bg-base-200 transition-colors"
                >
                  <ArrowLeft size={20} className="text-base-content/60" />
                </button>
                
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-vibrant/20 to-emerald-500/20 flex items-center justify-center shrink-0">
                  {otherUser?.avatarUrl ? (
                    <img
                      src={otherUser.avatarUrl}
                      alt={otherUser.name}
                      className="w-10 h-10 rounded-xl object-cover"
                    />
                  ) : (
                    <span className="text-sm font-black text-brand-vibrant">
                      {getInitials(otherUser?.name)}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-sm text-base-content truncate">
                    {otherUser?.name || 'Unknown User'}
                  </h3>
                  {otherUser?.location && (
                    <p className="text-xs text-base-content/50 truncate">
                      {otherUser.location}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleStartCall(otherUser?.id, 'audio')}
                    className="p-2.5 rounded-xl bg-brand-vibrant/10 text-brand-vibrant hover:bg-brand-vibrant/20 transition-colors"
                    title="Start audio call"
                  >
                    <Phone size={18} />
                  </button>
                  <button
                    onClick={() => handleStartCall(otherUser?.id, 'video')}
                    className="p-2.5 rounded-xl bg-brand-vibrant/10 text-brand-vibrant hover:bg-brand-vibrant/20 transition-colors"
                    title="Start video call"
                  >
                    <Video size={18} />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4">
                {messagesLoading ? (
                  <div className="flex flex-col items-center justify-center h-full text-base-content/30">
                    <Loader2 size={24} className="animate-spin mb-2" />
                    <p className="text-xs font-medium">Loading messages...</p>
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
                          isOwn={message.senderId === user?.id}
                        />
                      ))}
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              <form onSubmit={handleSendMessage} className="p-4 border-t border-base-300 bg-base-100">
                <div className="flex items-end gap-3">
                  <div className="flex-1 relative">
                    <textarea
                      ref={inputRef}
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage(e);
                        }
                      }}
                      placeholder="Type a message..."
                      rows={1}
                      className="w-full px-4 py-3 rounded-xl bg-base-200 border-none text-sm font-medium text-base-content placeholder:text-base-content/40 focus:outline-none focus:ring-2 focus:ring-brand-vibrant/20 resize-none max-h-32"
                      style={{
                        height: 'auto',
                        minHeight: '48px'
                      }}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={!newMessage.trim() || sending}
                    className="p-3 rounded-xl bg-brand-vibrant text-white hover:bg-brand-vibrant/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
                  >
                    {sending ? (
                      <Loader2 size={20} className="animate-spin" />
                    ) : (
                      <Send size={20} />
                    )}
                  </button>
                </div>
              </form>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
              <div className="w-20 h-20 rounded-2xl bg-brand-vibrant/10 flex items-center justify-center mb-6">
                <MessageCircle size={36} className="text-brand-vibrant/40" />
              </div>
              <h3 className="text-lg font-black text-base-content mb-2">
                Your Messages
              </h3>
              <p className="text-sm text-base-content/60 max-w-sm mb-6">
                Connect with fellow solo travelers, share tips, and plan adventures together.
              </p>
              <a
                href="/buddies"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-vibrant text-white font-bold text-sm hover:bg-brand-vibrant/90 transition-colors"
              >
                <MessageCircle size={16} />
                Find Travelers
              </a>
            </div>
          )}
        </div>
      </div>

      {callModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-brand-deep/80 backdrop-blur-md" onClick={() => setCallModalOpen(false)}></div>
          
          <div className="relative w-full max-w-md rounded-2xl overflow-hidden shadow-2xl animate-slide-up border border-white/20 bg-base-100">
            <div className="p-8 bg-gradient-to-br from-brand-deep/5 to-brand-vibrant/5">
              <div className="flex justify-between items-start mb-6">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    {otherUser?.avatarUrl ? (
                      <img
                        src={otherUser.avatarUrl}
                        alt={otherUser.name}
                        className="w-20 h-20 rounded-full object-cover border-4 border-brand-vibrant/20"
                      />
                    ) : (
                      <div className="w-20 h-20 rounded-full bg-gradient-to-br from-brand-vibrant/30 to-emerald-500/30 flex items-center justify-center border-4 border-brand-vibrant/20">
                        <span className="text-2xl font-black text-brand-vibrant">
                          {getInitials(otherUser?.name)}
                        </span>
                      </div>
                    )}
                    <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-warning flex items-center justify-center border-2 border-base-100 animate-pulse">
                      <Phone size={12} className="text-white" />
                    </div>
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-base-content">Calling...</h2>
                    <p className="text-sm text-base-content/70 mt-1">{otherUser?.name || 'Unknown User'}</p>
                    <div className="flex items-center gap-1.5 text-base-content/50 mt-1">
                      {callType === 'video' ? <Video size={14} /> : <Phone size={14} />}
                      <span className="text-xs">{callType === 'video' ? 'Video Call' : 'Audio Call'}</span>
                    </div>
                  </div>
                </div>
                <button 
                  onClick={() => setCallModalOpen(false)}
                  className="p-2 hover:bg-base-200/50 rounded-full transition-colors text-base-content/40"
                >
                  <X size={24} />
                </button>
              </div>
            </div>

            <div className="p-6 bg-base-100">
              <button
                onClick={() => setCallModalOpen(false)}
                className="w-full py-4 rounded-xl bg-error text-white font-bold text-sm hover:bg-error/90 transition-all flex items-center justify-center gap-2"
              >
                <PhoneOff size={20} />
                Cancel Call
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardShell>
  );
};

export default Messages;

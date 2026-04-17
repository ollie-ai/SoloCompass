import { create } from 'zustand';
import api from '../lib/api';

const useBuddyStore = create((set, get) => ({
  matches: [],
  requests: [],
  sentRequests: [],
  conversations: [],
  currentConversation: null,
  profile: null,
  loading: false,
  error: null,

  // Fetch buddy discovery matches
  fetchMatches: async (params = {}) => {
    set({ loading: true, error: null });
    try {
      const query = new URLSearchParams(params).toString();
      const res = await api.get(`/matching/discovery${query ? `?${query}` : ''}`);
      const data = res.data.data || res.data;
      set({
        matches: data.matches || data || [],
        loading: false,
      });
    } catch (err) {
      console.error('[BuddyStore] Failed to fetch matches:', err);
      set({ loading: false, error: err.response?.data?.error?.message || 'Failed to load matches' });
    }
  },

  // Fetch incoming buddy requests
  fetchRequests: async () => {
    set({ loading: true, error: null });
    try {
      const res = await api.get('/matching/requests');
      const data = res.data.data || res.data;
      set({
        requests: data.received || data.requests || data || [],
        sentRequests: data.sent || [],
        loading: false,
      });
    } catch (err) {
      console.error('[BuddyStore] Failed to fetch requests:', err);
      set({ loading: false, error: err.response?.data?.error?.message || 'Failed to load requests' });
    }
  },

  // Send a buddy request
  sendRequest: async (targetUserId, message = '') => {
    try {
      const res = await api.post('/matching/request', { targetUserId, message });
      const newRequest = res.data.data;
      set((state) => ({
        sentRequests: [newRequest, ...state.sentRequests],
      }));
      return newRequest;
    } catch (err) {
      console.error('[BuddyStore] Failed to send request:', err);
      throw err;
    }
  },

  // Respond to a buddy request (accept / decline)
  respondToRequest: async (requestId, action) => {
    try {
      const res = await api.put(`/matching/request/${requestId}`, { action });
      set((state) => ({
        requests: state.requests.filter((r) => r.id !== requestId),
      }));
      return res.data.data;
    } catch (err) {
      console.error('[BuddyStore] Failed to respond to request:', err);
      throw err;
    }
  },

  // Fetch all buddy conversations
  fetchConversations: async () => {
    set({ loading: true, error: null });
    try {
      const res = await api.get('/messages/conversations');
      const data = res.data.data || res.data;
      set({
        conversations: data.conversations || data || [],
        loading: false,
      });
    } catch (err) {
      console.error('[BuddyStore] Failed to fetch conversations:', err);
      set({ loading: false, error: err.response?.data?.error?.message || 'Failed to load conversations' });
    }
  },

  // Set the currently open conversation
  setCurrentConversation: (conversation) => set({ currentConversation: conversation }),

  // Fetch own matching profile
  fetchProfile: async () => {
    try {
      const res = await api.get('/matching/profile');
      set({ profile: res.data.data || res.data });
    } catch (err) {
      console.error('[BuddyStore] Failed to fetch profile:', err);
    }
  },

  // Update matching profile
  updateProfile: async (updates) => {
    try {
      const res = await api.put('/matching/profile', updates);
      const updated = res.data.data || res.data;
      set({ profile: updated });
      return updated;
    } catch (err) {
      console.error('[BuddyStore] Failed to update profile:', err);
      throw err;
    }
  },

  // Clear error state
  clearError: () => set({ error: null }),

  // Reset store (on logout)
  reset: () => set({
    matches: [],
    requests: [],
    sentRequests: [],
    conversations: [],
    currentConversation: null,
    profile: null,
    loading: false,
    error: null,
  }),
}));

export default useBuddyStore;

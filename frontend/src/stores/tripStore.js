import { create } from 'zustand';
import api from '../lib/api';

const useTripStore = create((set, get) => ({
  trips: [],
  currentTrip: null,
  loading: false,
  error: null,
  totalCount: 0,

  // Fetch all trips for the current user
  fetchTrips: async (params = {}) => {
    set({ loading: true, error: null });
    try {
      const query = new URLSearchParams(params).toString();
      const res = await api.get(`/trips${query ? `?${query}` : ''}`);
      const data = res.data.data || res.data;
      set({
        trips: data.trips || data || [],
        totalCount: data.total || (data.trips || data || []).length,
        loading: false,
      });
    } catch (err) {
      console.error('[TripStore] Failed to fetch trips:', err);
      set({ loading: false, error: err.response?.data?.error?.message || 'Failed to load trips' });
    }
  },

  // Fetch a single trip by id
  fetchTrip: async (tripId) => {
    set({ loading: true, error: null });
    try {
      const res = await api.get(`/trips/${tripId}`);
      const trip = res.data.data?.trip || res.data.data || res.data;
      set({ currentTrip: trip, loading: false });
      return trip;
    } catch (err) {
      console.error('[TripStore] Failed to fetch trip:', err);
      set({ loading: false, error: err.response?.data?.error?.message || 'Failed to load trip' });
      return null;
    }
  },

  // Create a new trip
  createTrip: async (tripData) => {
    set({ loading: true, error: null });
    try {
      const res = await api.post('/trips', tripData);
      const newTrip = res.data.data?.trip || res.data.data;
      set((state) => ({
        trips: [newTrip, ...state.trips],
        totalCount: state.totalCount + 1,
        loading: false,
      }));
      return newTrip;
    } catch (err) {
      console.error('[TripStore] Failed to create trip:', err);
      set({ loading: false, error: err.response?.data?.error?.message || 'Failed to create trip' });
      throw err;
    }
  },

  // Update an existing trip
  updateTrip: async (tripId, updates) => {
    try {
      const res = await api.put(`/trips/${tripId}`, updates);
      const updated = res.data.data?.trip || res.data.data;
      set((state) => ({
        trips: state.trips.map((t) => (t.id === tripId ? { ...t, ...updated } : t)),
        currentTrip: state.currentTrip?.id === tripId ? { ...state.currentTrip, ...updated } : state.currentTrip,
      }));
      return updated;
    } catch (err) {
      console.error('[TripStore] Failed to update trip:', err);
      throw err;
    }
  },

  // Delete a trip
  deleteTrip: async (tripId) => {
    try {
      await api.delete(`/trips/${tripId}`);
      set((state) => ({
        trips: state.trips.filter((t) => t.id !== tripId),
        totalCount: Math.max(0, state.totalCount - 1),
        currentTrip: state.currentTrip?.id === tripId ? null : state.currentTrip,
      }));
    } catch (err) {
      console.error('[TripStore] Failed to delete trip:', err);
      throw err;
    }
  },

  // Set the current trip without fetching
  setCurrentTrip: (trip) => set({ currentTrip: trip }),

  // Clear error state
  clearError: () => set({ error: null }),

  // Reset store (on logout)
  reset: () => set({ trips: [], currentTrip: null, loading: false, error: null, totalCount: 0 }),
}));

export default useTripStore;

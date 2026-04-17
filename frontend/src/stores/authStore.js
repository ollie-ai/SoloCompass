import { create } from 'zustand';
import api from '../lib/api';

export const useAuthStore = create((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,
  initialized: false,

  initialize: async () => {
    // Prevent multiple initialization calls
    if (get().initialized) {
      return;
    }
    
    try {
      set({ isLoading: true });
      const response = await api.get('/auth/me');
      const user = response.data.data.user;
      set({
        user,
        isAuthenticated: true,
        isLoading: false,
        initialized: true,
      });
    } catch (error) {
      // Not authenticated is normal, not an error
      set({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        initialized: true,
      });
    }
  },

  refreshUser: async () => {
    try {
      const response = await api.get('/auth/me');
      set({
        user: response.data.data.user,
        isAuthenticated: true,
      });
      return response.data.data.user;
    } catch (error) {
      // Intentionally silent - toast handles user notification
    }
  },

  login: async (email, password) => {
    try {
      set({ error: null, isLoading: true });
      const response = await api.post('/auth/login', { email, password });
      set({
        user: response.data.data.user,
        isAuthenticated: true,
        isLoading: false,
      });
      return response.data;
    } catch (error) {
      const errorData = error.response?.data?.error;
      let errorMsg = 'Login failed';
      
      if (typeof errorData === 'string') {
        errorMsg = errorData;
      } else if (errorData?.details?.[0]?.msg) {
        // Extract the first validation error if available
        errorMsg = errorData.details[0].msg;
      } else if (errorData?.message) {
        errorMsg = errorData.message;
      } else if (error.response?.data?.message) {
        errorMsg = error.response.data.message;
      }
      
      set({
        error: errorMsg,
        isLoading: false,
      });
      throw error;
    }
  },

  register: async (email, password, name, referralCode) => {
    try {
      set({ error: null, isLoading: true });
      const payload = { email, password, name };
      if (referralCode) payload.referralCode = referralCode;
      const response = await api.post('/auth/register', payload);
      set({
        user: response.data.data.user,
        isAuthenticated: true,
        isLoading: false,
      });
      return response.data;
    } catch (error) {
      const errorData = error.response?.data?.error;
      let errorMsg = 'Registration failed';
      
      if (typeof errorData === 'string') {
        errorMsg = errorData;
      } else if (errorData?.details?.[0]?.msg) {
        // Extract the first validation error if available
        errorMsg = errorData.details[0].msg;
      } else if (errorData?.message) {
        errorMsg = errorData.message;
      } else if (error.response?.data?.message) {
        errorMsg = error.response.data.message;
      }
      
      set({
        error: errorMsg,
        isLoading: false,
      });
      throw error;
    }
  },

  logout: async () => {
    try {
      await api.post('/auth/logout');
    } catch (error) {
      // Intentionally silent - toast handles user notification
    } finally {
      set({
        user: null,
        isAuthenticated: false,
        isLoading: false,
      });
    }
  },

  updateUser: (userData) => {
    set((state) => ({
      user: { ...state.user, ...userData },
    }));
  },

  clearError: () => {
    set({ error: null });
  },

  setAuthFromToken: async (token, refreshToken) => {
    localStorage.setItem('token', token);
    if (refreshToken) localStorage.setItem('refreshToken', refreshToken);
    try {
      const response = await api.get('/auth/me');
      set({
        user: response.data.data.user,
        isAuthenticated: true,
        isLoading: false,
        initialized: true,
      });
      return response.data.data.user;
    } catch (error) {
      // Intentionally silent - toast handles user notification
      set({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        initialized: true,
      });
      return null;
    }
  },
}));

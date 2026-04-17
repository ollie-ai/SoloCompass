import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach Authorization header from localStorage if present
api.interceptors.request.use(
  (config) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
    if (token && !config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
);

export const createCancelToken = () => axios.CancelToken.source();

export const isCancel = (error) => axios.isCancel(error);

export const createApiRequest = (cancelToken) => ({
  get: (url, config = {}) => api.get(url, { ...config, cancelToken }),
  post: (url, data, config = {}) => api.post(url, data, { ...config, cancelToken }),
  put: (url, data, config = {}) => api.put(url, data, { ...config, cancelToken }),
  delete: (url, config = {}) => api.delete(url, { ...config, cancelToken }),
});

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

api.interceptors.request.use(
  (config) => {
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry && !originalRequest.url.includes('/auth/login') && !originalRequest.url.includes('/auth/refresh')) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then(() => {
            return api(originalRequest);
          })
          .catch(err => {
            return Promise.reject(err);
          });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        await api.post('/auth/refresh');
        processQueue(null);
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        
        // Dynamic import to break circular dependency and fix Vite 500
        import('../stores/authStore').then(module => {
          module.useAuthStore.getState().logout();
        }).catch(err => {
          console.error('[api] Failed to dynamically import authStore for logout:', err);
        });
        
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

const getAuthHeaders = () => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
  return token ? { Authorization: `Bearer ${token}` } : {}
}

// Accommodation - uses /accommodations endpoint
export const getTripAccommodation = async (tripId) => {
  const response = await api.get(`/accommodations/${tripId}/accommodation`, { headers: getAuthHeaders() })
  return response.data
}

export const createTripAccommodation = async (tripId, data) => {
  const response = await api.post(`/accommodations/${tripId}/accommodation`, data, { headers: getAuthHeaders() })
  return response.data
}

export const updateTripAccommodation = async (tripId, data) => {
  const response = await api.put(`/accommodations/${tripId}/accommodation`, data, { headers: getAuthHeaders() })
  return response.data
}

export const deleteTripAccommodation = async (tripId) => {
  const response = await api.delete(`/accommodations/${tripId}/accommodation`, { headers: getAuthHeaders() })
  return response.data
}

// Bookings - uses /bookings endpoint
export const getTripBookings = async (tripId) => {
  const response = await api.get(`/bookings/${tripId}/bookings`, { headers: getAuthHeaders() })
  return response.data
}

export const createTripBooking = async (tripId, data) => {
  const response = await api.post(`/bookings/${tripId}/bookings`, data, { headers: getAuthHeaders() })
  return response.data
}

export const updateTripBooking = async (bookingId, data) => {
  const response = await api.put(`/bookings/${bookingId}`, data, { headers: getAuthHeaders() })
  return response.data
}

export const deleteTripBooking = async (bookingId) => {
  const response = await api.delete(`/bookings/${bookingId}`, { headers: getAuthHeaders() })
  return response.data
}

// Documents - uses /trip-documents endpoint
export const getTripDocuments = async (tripId) => {
  const response = await api.get(`/trip-documents/${tripId}/documents`, { headers: getAuthHeaders() })
  return response.data
}

export const createTripDocument = async (tripId, data) => {
  const response = await api.post(`/trip-documents/${tripId}/documents`, data, { headers: getAuthHeaders() })
  return response.data
}

export const deleteTripDocument = async (documentId) => {
  const response = await api.delete(`/trip-documents/${documentId}`, { headers: getAuthHeaders() })
  return response.data
}

// Places - uses /trip-places endpoint
export const getTripPlaces = async (tripId) => {
  const response = await api.get(`/trip-places/${tripId}/places`, { headers: getAuthHeaders() })
  return response.data
}

export const createTripPlace = async (tripId, data) => {
  const response = await api.post(`/trip-places/${tripId}/places`, data, { headers: getAuthHeaders() })
  return response.data
}

export const updateTripPlace = async (placeId, data) => {
  const response = await api.put(`/trip-places/${placeId}`, data, { headers: getAuthHeaders() })
  return response.data
}

export const deleteTripPlace = async (placeId) => {
  const response = await api.delete(`/trip-places/${placeId}`, { headers: getAuthHeaders() })
  return response.data
}

// Advisories
export const getAdvisories = async () => {
  const response = await api.get('/advisories', { headers: getAuthHeaders() })
  return response.data
}

// Budget
export const getTripBudget = async (tripId, targetCurrency = null) => {
  const url = targetCurrency ? `/budget/${tripId}?targetCurrency=${targetCurrency}` : `/budget/${tripId}`
  const response = await api.get(url, { headers: getAuthHeaders() })
  return response.data
}

// Checklist
export const getTripChecklist = async (tripId) => {
  const response = await api.get(`/checklist/${tripId}`, { headers: getAuthHeaders() })
  return response.data
}

export const updateTripChecklist = async (tripId, itemKey, completed) => {
  const response = await api.post(`/checklist/${tripId}`, { itemKey, completed }, { headers: getAuthHeaders() })
  return response.data
}

export const exportTripPDF = async (tripId) => {
  const response = await api.get(`/trips/${tripId}/export-pdf`, { 
    headers: getAuthHeaders(),
    responseType: 'blob'
  })
  return response.data
}

export const duplicatePackingList = async (listId) => {
  const response = await api.post(`/packing-lists/${listId}/duplicate`, {}, { headers: getAuthHeaders() })
  return response.data
}

export const downloadTripDocument = async (documentId) => {
  const response = await api.get(`/trip-documents/${documentId}/download`, { 
    headers: getAuthHeaders(),
    responseType: 'blob'
  })
  return response.data
}

export const getNearbyPlaces = async (lat, lng, type = null, radius = 1000) => {
  const params = { lat, lng, radius }
  if (type) params.type = type
  const response = await api.get('/places/nearby', { params })
  return response.data
}

// Trip sharing
export const shareTrip = async (tripId) => {
  const response = await api.post(`/trips/${tripId}/share`, {}, { headers: getAuthHeaders() })
  return response.data
}

// Trip duplication
export const duplicateTrip = async (tripId) => {
  const response = await api.post(`/trips/${tripId}/duplicate`, {}, { headers: getAuthHeaders() })
  return response.data
}

// Packing list sharing
export const sharePackingList = async (listId) => {
  const response = await api.post(`/packing-lists/${listId}/share`, {}, { headers: getAuthHeaders() })
  return response.data
}

// Journal
export const getJournalTemplates = async () => {
  const response = await api.get('/journal/templates', { headers: getAuthHeaders() })
  return response.data
}

export const getJournalEntries = async (tripId) => {
  const response = await api.get(`/journal/${tripId}/entries`, { headers: getAuthHeaders() })
  return response.data
}

export const createJournalEntry = async (tripId, data) => {
  const response = await api.post(`/journal/${tripId}/entries`, data, { headers: getAuthHeaders() })
  return response.data
}

export const shareJournalEntry = async (entryId, expiresAt = null) => {
  const response = await api.post(`/journal/entries/${entryId}/share`, { expiresAt }, { headers: getAuthHeaders() })
  return response.data
}

// Exchange rates
export const getExchangeRates = async (base = 'GBP', symbols = '') => {
  const response = await api.get(`/exchange/rates`, { params: { base, symbols }, headers: getAuthHeaders() })
  return response.data
}

// Budget summary
export const getBudgetSummary = async (tripId) => {
  const response = await api.get(`/budget/${tripId}/summary`, { headers: getAuthHeaders() })
  return response.data
}

// Trip templates
export const getTripTemplates = async () => {
  const response = await api.get('/trips/templates/list', { headers: getAuthHeaders() })
  return response.data
}

export default api;

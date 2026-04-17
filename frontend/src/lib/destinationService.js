import api from './api';

const destinationService = {
  // List destinations with filters
  list: (params = {}) => api.get('/destinations', { params }),

  // Get single destination by ID
  getById: (id) => api.get(`/destinations/${id}`),

  // Get destination by slug
  getBySlug: (slug) => api.get(`/destinations/by-slug/${slug}`),

  // Search destinations
  search: (q, params = {}) => api.get('/destinations/search', { params: { q, ...params } }),

  // Get trending destinations
  trending: (limit = 10) => api.get('/destinations/trending', { params: { limit } }),

  // Compare destinations
  compare: (ids) => api.get('/destinations/compare', { params: { ids: ids.join(',') } }),

  // Get recommendations
  recommendations: () => api.get('/destinations/recommendations/me'),

  // Get weather data
  getWeather: (id) => api.get(`/destinations/${id}/weather`),

  // Get cost breakdown
  getCost: (id) => api.get(`/destinations/${id}/cost`),

  // Get practical info
  getPractical: (id) => api.get(`/destinations/${id}/practical`),

  // Get sunrise/sunset
  getSunriseSunset: (id, date) => api.get(`/destinations/${id}/sunrise-sunset`, { params: date ? { date } : {} }),

  // Get reviews
  getReviews: (id, params = {}) => api.get(`/destinations/${id}/reviews`, { params }),

  // Submit review
  submitReview: (id, data) => api.post(`/destinations/${id}/reviews`, data),

  // Get community tips
  getTips: (id, params = {}) => api.get(`/destinations/${id}/tips`, { params }),

  // Submit tip
  submitTip: (id, data) => api.post(`/destinations/${id}/tips`, data),

  // Safety data
  getSafety: (id) => api.get(`/safety/destination/${id}`),
  getSafetyScores: (id) => api.get(`/safety/destination/${id}/scores`),
  getSafetyAreas: (id) => api.get(`/safety/destination/${id}/areas`),
  getScams: (id) => api.get(`/safety/destination/${id}/scams`),
  getEmergencyContacts: (id) => api.get(`/safety/destination/${id}/emergency`),
};

export default destinationService;

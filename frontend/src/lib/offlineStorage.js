const OFFLINE_DATA_KEY = 'solocompass_offline_data';

const OFFLINE_DATA_SCHEMA = {
  trips: null,
  tripDetails: {},
  destinations: null,
  destinationAI: null,
  emergencyNumbers: null,
  currencyRates: null,
  lastSync: null
};

export const offlineStorage = {
  getOfflineData() {
    try {
      const data = localStorage.getItem(OFFLINE_DATA_KEY);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Error reading offline data:', error);
      return null;
    }
  },

  setOfflineData(data) {
    try {
      const existingData = this.getOfflineData() || OFFLINE_DATA_SCHEMA;
      const updatedData = {
        ...existingData,
        ...data,
        lastSync: new Date().toISOString()
      };
      localStorage.setItem(OFFLINE_DATA_KEY, JSON.stringify(updatedData));
      return true;
    } catch (error) {
      console.error('Error saving offline data:', error);
      return false;
    }
  },

  getTrips() {
    const data = this.getOfflineData();
    return data?.trips || null;
  },

  setTrips(trips) {
    return this.setOfflineData({ trips });
  },

  getDestinations() {
    const data = this.getOfflineData();
    return data?.destinations || null;
  },

  setDestinations(destinations) {
    return this.setOfflineData({ destinations });
  },

  getEmergencyNumbers() {
    const data = this.getOfflineData();
    return data?.emergencyNumbers || null;
  },

  setEmergencyNumbers(numbers) {
    return this.setOfflineData({ emergencyNumbers: numbers });
  },

  getCurrencyRates() {
    const data = this.getOfflineData();
    return data?.currencyRates || null;
  },

  setCurrencyRates(rates) {
    return this.setOfflineData({ currencyRates: rates });
  },

  getDestinationAI(destinationId) {
    const data = this.getOfflineData();
    const aiData = data?.destinationAI || {};
    return aiData[destinationId] || null;
  },

  setDestinationAI(destinationId, aiContent) {
    const data = this.getOfflineData();
    const aiData = data?.destinationAI || {};
    aiData[destinationId] = {
      ...aiContent,
      cachedAt: new Date().toISOString()
    };
    return this.setOfflineData({ destinationAI: aiData });
  },

  getAllDestinationAI() {
    const data = this.getOfflineData();
    return data?.destinationAI || {};
  },

  isDataStale(maxAgeMs = 24 * 60 * 60 * 1000) {
    const data = this.getOfflineData();
    if (!data?.lastSync) return true;
    
    const lastSyncTime = new Date(data.lastSync).getTime();
    const now = Date.now();
    return (now - lastSyncTime) > maxAgeMs;
  },

  clearOfflineData() {
    try {
      localStorage.removeItem(OFFLINE_DATA_KEY);
      return true;
    } catch (error) {
      console.error('Error clearing offline data:', error);
      return false;
    }
  },

  getOfflineEssentialsStatus() {
    const data = this.getOfflineData();
    return {
      offlineMaps: !!data?.destinations,
      emergencyNumbers: !!data?.emergencyNumbers,
      currencyOffline: !!data?.currencyRates
    };
  },

  /**
   * Cache full trip detail (itinerary, documents, bookings, etc.) for offline viewing.
   * @param {string|number} tripId
   * @param {object} detail  — the full trip detail object to cache
   */
  setTripDetail(tripId, detail) {
    const data = this.getOfflineData();
    const existing = data?.tripDetails || {};
    existing[tripId] = {
      ...detail,
      cachedAt: new Date().toISOString(),
    };
    return this.setOfflineData({ tripDetails: existing });
  },

  /**
   * Retrieve a cached trip detail for offline viewing.
   * @param {string|number} tripId
   * @returns {object|null}
   */
  getTripDetail(tripId) {
    const data = this.getOfflineData();
    return data?.tripDetails?.[tripId] || null;
  },

  /**
   * Remove a single cached trip detail (e.g. when a trip is deleted).
   * @param {string|number} tripId
   */
  removeTripDetail(tripId) {
    const data = this.getOfflineData();
    if (!data?.tripDetails?.[tripId]) return true;
    const tripDetails = { ...data.tripDetails };
    delete tripDetails[tripId];
    return this.setOfflineData({ tripDetails });
  },

  /**
   * Return a map of all cached trip details.
   * @returns {object}
   */
  getAllTripDetails() {
    const data = this.getOfflineData();
    return data?.tripDetails || {};
  }
};

export default offlineStorage;
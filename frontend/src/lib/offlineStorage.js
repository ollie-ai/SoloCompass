const OFFLINE_DATA_KEY = 'solocompass_offline_data';

const OFFLINE_DATA_SCHEMA = {
  trips: null,
  destinations: null,
  destinationAI: null,
  emergencyNumbers: null,
  currencyRates: null,
  returnPlan: null,
  pendingCheckins: [],
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

  getPendingCheckins() {
    const data = this.getOfflineData();
    return data?.pendingCheckins || [];
  },

  addPendingCheckin(checkin) {
    const data = this.getOfflineData() || { ...OFFLINE_DATA_SCHEMA };
    const pending = data.pendingCheckins || [];
    pending.push({ ...checkin, queuedAt: new Date().toISOString() });
    return this.setOfflineData({ pendingCheckins: pending });
  },

  clearPendingCheckins() {
    return this.setOfflineData({ pendingCheckins: [] });
  },

  getReturnPlan() {
    const data = this.getOfflineData();
    return data?.returnPlan || null;
  },

  setReturnPlan(plan) {
    return this.setOfflineData({ returnPlan: plan });
  },

  clearReturnPlan() {
    return this.setOfflineData({ returnPlan: null });
  },

  getOfflineEssentialsStatus() {
    const data = this.getOfflineData();
    return {
      offlineMaps: !!data?.destinations,
      emergencyNumbers: !!data?.emergencyNumbers,
      currencyOffline: !!data?.currencyRates,
      returnPlan: !!data?.returnPlan
    };
  }
};

export default offlineStorage;
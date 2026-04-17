import { useState, useEffect, useCallback } from 'react';
import { FEATURES } from '../config/features';
import api from '../lib/api';
import { useAuthStore } from '../stores/authStore';

// In-memory cache
let flagsCache = null;
let cacheExpiry = 0;
const CACHE_TTL = 60 * 1000; // 1 minute

async function loadFlags() {
  const now = Date.now();
  if (flagsCache && now < cacheExpiry) return flagsCache;

  try {
    const res = await api.get('/v1/feature-flags');
    flagsCache = res.data?.data || {};
    cacheExpiry = now + CACHE_TTL;
    return flagsCache;
  } catch {
    // Fallback to static config
    return {};
  }
}

function useFeature(featureName) {
  const { isAuthenticated } = useAuthStore();
  const [isEnabled, setIsEnabled] = useState(
    // Optimistic: use static config while loading
    FEATURES[featureName] === true
  );
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!featureName || !isAuthenticated) return;

    setLoading(true);
    loadFlags().then(flags => {
      if (featureName in flags) {
        setIsEnabled(flags[featureName]);
      } else {
        // Fall back to static config
        setIsEnabled(FEATURES[featureName] === true);
      }
    }).catch(() => {
      setIsEnabled(FEATURES[featureName] === true);
    }).finally(() => setLoading(false));
  }, [featureName, isAuthenticated]);

  const isEnabledFn = useCallback((feature) => {
    if (flagsCache && feature in flagsCache) return flagsCache[feature];
    return FEATURES[feature] === true;
  }, []);

  return {
    isEnabled,
    isDisabled: !isEnabled,
    isEnabledFn,
    loading,
    features: FEATURES,
  };
}

export default useFeature;

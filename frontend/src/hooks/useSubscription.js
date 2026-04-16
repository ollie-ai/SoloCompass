import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '../stores/authStore';
import api from '../lib/api';

const CACHE_TTL_MS = 30_000;

let cache = null;
let cacheTime = 0;

export function useSubscription() {
  const { user } = useAuthStore();
  const [state, setState] = useState({
    tier: user?.subscription_tier || 'explorer',
    isPremium: !!(user?.is_premium),
    subscriptionStatus: null,
    expiresAt: user?.premium_expires_at || null,
    cancelAtPeriodEnd: false,
    interval: 'month',
    stripePortalUrl: null,
    usage: null,
    loading: true,
    error: null,
  });

  const fetchData = useCallback(async (force = false) => {
    const now = Date.now();
    if (!force && cache && (now - cacheTime) < CACHE_TTL_MS) {
      setState(prev => ({ ...prev, ...cache, loading: false }));
      return;
    }

    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const [statusRes, usageRes] = await Promise.all([
        api.get('/billing/status'),
        api.get('/billing/usage').catch(() => ({ data: { data: null } })),
      ]);

      const status = statusRes.data.data;
      const usage = usageRes.data.data;

      const newState = {
        tier: status.tier || user?.subscription_tier || 'explorer',
        isPremium: status.isPremium ?? !!(user?.is_premium),
        subscriptionStatus: status.subscriptionStatus,
        expiresAt: status.expiresAt,
        cancelAtPeriodEnd: status.cancelAtPeriodEnd,
        interval: status.interval || 'month',
        stripePortalUrl: status.stripePortalUrl,
        usage,
        loading: false,
        error: null,
      };

      cache = newState;
      cacheTime = Date.now();
      setState(newState);
    } catch (err) {
      setState(prev => ({
        ...prev,
        tier: user?.subscription_tier || 'explorer',
        isPremium: !!(user?.is_premium),
        loading: false,
        error: err.message,
      }));
    }
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (user?.id) fetchData();
  }, [user?.id, fetchData]);

  const refetch = useCallback(() => {
    cache = null;
    cacheTime = 0;
    fetchData(true);
  }, [fetchData]);

  return { ...state, refetch };
}

export default useSubscription;

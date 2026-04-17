/**
 * TanStack Query client configuration
 *
 * Centralised QueryClient with production-suitable defaults:
 *  - staleTime 60 s  — data is considered fresh for 60 seconds
 *  - gcTime 5 min    — unused queries are garbage-collected after 5 minutes
 *  - 2 retries       — automatic retry on network/server errors
 *  - no retry on 4xx — don't retry auth/validation errors
 */

import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,          // 60 seconds
      gcTime: 5 * 60 * 1000,         // 5 minutes
      retry: (failureCount, error) => {
        // Never retry on client errors (4xx)
        if (error?.status >= 400 && error?.status < 500) return false;
        return failureCount < 2;
      },
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
});

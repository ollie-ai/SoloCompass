/**
 * useAuth — thin hook wrapper around useAuthStore.
 * Provides a clean, spec-compliant interface for auth state and actions.
 */
import { useAuthStore } from '../stores/authStore';

export function useAuth() {
  const {
    user,
    isAuthenticated,
    isLoading,
    error,
    login,
    logout,
    register,
    initialize,
    refreshUser,
    clearError,
    updateUser,
  } = useAuthStore();

  return {
    user,
    isAuthenticated,
    isLoading,
    error,
    login,
    logout,
    register,
    initialize,
    refreshUser,
    clearError,
    updateUser,
  };
}

export default useAuth;

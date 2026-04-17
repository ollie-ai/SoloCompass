import { useState, useEffect, useCallback } from 'react';
import { Link2, Unlink, Github, Chrome, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import api from '../../lib/api';
import toast from 'react-hot-toast';

const PROVIDERS = [
  { id: 'google', name: 'Google', icon: Chrome, color: 'bg-red-500' },
  { id: 'github', name: 'GitHub', icon: Github, color: 'bg-gray-800' },
];

export default function ConnectedAccounts() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);

  const fetchAccounts = useCallback(async () => {
    try {
      const res = await api.get('/v1/settings/connected-accounts');
      if (res.data?.success) setAccounts(res.data.data || []);
    } catch (err) {
      console.error('Failed to fetch connected accounts:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const isLinked = (providerId) =>
    accounts.some((a) => a.provider === providerId);

  const unlinkAccount = async (provider) => {
    setActionLoading(provider);
    try {
      await api.delete(`/v1/settings/connected-accounts/${provider}`);
      toast.success(`${provider} account unlinked`);
      fetchAccounts();
    } catch {
      toast.error('Failed to unlink account');
    } finally {
      setActionLoading(null);
    }
  };

  const linkAccount = (provider) => {
    window.location.href = `/api/auth/${provider}?link=true`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-base-content/40" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Link2 className="w-5 h-5 text-brand-vibrant" />
        <h3 className="text-lg font-semibold">Connected Accounts</h3>
      </div>

      <div className="grid gap-3">
        {PROVIDERS.map((provider) => {
          const Icon = provider.icon;
          const linked = isLinked(provider.id);
          const busy = actionLoading === provider.id;

          return (
            <motion.div
              key={provider.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center justify-between rounded-xl bg-base-200/60 backdrop-blur-sm border border-base-300/50 p-4"
            >
              <div className="flex items-center gap-3">
                <div className={`${provider.color} rounded-lg p-2`}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="font-medium">{provider.name}</p>
                  <p className="text-xs text-base-content/50">
                    {linked ? 'Connected' : 'Not connected'}
                  </p>
                </div>
              </div>

              <button
                className={`btn btn-sm gap-1.5 ${linked ? 'btn-ghost text-error' : 'btn-outline'}`}
                onClick={() => (linked ? unlinkAccount(provider.id) : linkAccount(provider.id))}
                disabled={busy}
              >
                {busy ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : linked ? (
                  <>
                    <Unlink className="w-3.5 h-3.5" />
                    Unlink
                  </>
                ) : (
                  <>
                    <Link2 className="w-3.5 h-3.5" />
                    Link
                  </>
                )}
              </button>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

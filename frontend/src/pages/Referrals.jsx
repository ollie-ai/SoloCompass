import { useEffect, useMemo, useState } from 'react';
import api from '../lib/api';
import SEO from '../components/SEO';

export default function Referrals() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copyStatus, setCopyStatus] = useState('');

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const response = await api.get('/referrals/me');
        if (mounted) setData(response.data?.data || null);
      } catch (err) {
        if (mounted) setError('Failed to load referral data');
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, []);

  const inviteUrl = useMemo(() => {
    if (!data?.code) return '';
    return `${window.location.origin}/register?ref=${encodeURIComponent(data.code)}`;
  }, [data]);

  const copyLink = async () => {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopyStatus('Invite link copied');
    } catch {
      setCopyStatus('Could not copy link');
    }
  };

  return (
    <>
      <SEO title="Referral Programme - SoloCompass" description="Invite friends and earn reward points with SoloCompass referrals." />
      <div className="min-h-screen bg-mesh pt-24 pb-20">
        <div className="max-w-3xl mx-auto px-4">
          <h1 className="text-4xl font-black mb-3">Invite friends, earn rewards</h1>
          <p className="text-base-content/70 mb-8">Share your referral link. Earn 100 points for each successful invite.</p>

          <div className="glass-card p-6 rounded-2xl">
            {loading && <p>Loading referral profile...</p>}
            {error && <p className="text-error">{error}</p>}
            {!loading && data && (
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-base-content/60">Your referral code</p>
                  <p className="text-2xl font-black tracking-widest">{data.code}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-base-200">
                    <p className="text-sm text-base-content/60">Invites</p>
                    <p className="text-xl font-bold">{data.invites}</p>
                  </div>
                  <div className="p-4 rounded-xl bg-base-200">
                    <p className="text-sm text-base-content/60">Reward points</p>
                    <p className="text-xl font-bold">{data.rewardPoints}</p>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-base-content/60 mb-2">Invite link</p>
                  <div className="flex gap-2">
                    <input readOnly value={inviteUrl} className="input input-bordered flex-1" />
                    <button onClick={copyLink} className="btn btn-primary">Copy</button>
                  </div>
                  {copyStatus && <p className="mt-2 text-sm text-base-content/60">{copyStatus}</p>}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

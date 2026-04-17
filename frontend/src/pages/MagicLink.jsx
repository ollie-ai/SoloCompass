import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { Loader, CheckCircle, XCircle, Zap } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import api from '../lib/api';
import toast from 'react-hot-toast';

export default function MagicLink() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();
  const { initialize } = useAuthStore();

  const [mode, setMode] = useState(token ? 'verifying' : 'request'); // request | verifying | success | error
  const [email, setEmail] = useState('');
  const [emailSent, setEmailSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!token) return;

    const verify = async () => {
      try {
        await api.post('/auth/magic-link/verify', { token });
        await initialize();
        setMode('success');
        setTimeout(() => navigate('/dashboard'), 2000);
      } catch (err) {
        setMode('error');
        setErrorMsg(err.response?.data?.error?.message || 'Invalid or expired magic link.');
      }
    };

    verify();
  }, [token, navigate, initialize]);

  const handleRequest = async (e) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    try {
      await api.post('/auth/magic-link', { email });
      setEmailSent(true);
    } catch (err) {
      toast.error('Failed to send magic link. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (mode === 'verifying') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-base-200 px-4">
        <div className="card bg-base-100 shadow-lg max-w-md w-full p-8 text-center">
          <Loader className="w-12 h-12 mx-auto mb-4 text-brand-vibrant animate-spin" />
          <h1 className="text-2xl font-bold mb-2">Signing you in…</h1>
          <p className="text-base-content/60">Verifying your magic link.</p>
        </div>
      </div>
    );
  }

  if (mode === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-base-200 px-4">
        <div className="card bg-base-100 shadow-lg max-w-md w-full p-8 text-center">
          <CheckCircle className="w-12 h-12 mx-auto mb-4 text-success" />
          <h1 className="text-2xl font-bold mb-2">Signed in!</h1>
          <p className="text-base-content/60">Redirecting to your dashboard…</p>
        </div>
      </div>
    );
  }

  if (mode === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-base-200 px-4">
        <div className="card bg-base-100 shadow-lg max-w-md w-full p-8 text-center">
          <XCircle className="w-12 h-12 mx-auto mb-4 text-error" />
          <h1 className="text-2xl font-bold mb-2">Link Expired</h1>
          <p className="text-base-content/60 mb-4">{errorMsg}</p>
          <Link to="/magic-link" className="btn btn-primary">Request New Link</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-base-200 px-4">
      <div className="card bg-base-100 shadow-lg max-w-md w-full p-8">
        <div className="text-center mb-6">
          <Zap className="w-10 h-10 mx-auto mb-3 text-brand-vibrant" />
          <h1 className="text-2xl font-bold">Magic Link Login</h1>
          <p className="text-base-content/60 mt-1">Sign in without a password — we'll email you a link.</p>
        </div>
        {emailSent ? (
          <div className="text-center">
            <CheckCircle className="w-10 h-10 mx-auto mb-3 text-success" />
            <p className="font-medium">Check your inbox!</p>
            <p className="text-base-content/60 text-sm mt-1">We sent a magic link to <strong>{email}</strong>. It expires in 15 minutes.</p>
            <button onClick={() => setEmailSent(false)} className="btn btn-ghost btn-sm mt-4">Try a different email</button>
          </div>
        ) : (
          <form onSubmit={handleRequest} className="space-y-4">
            <div className="form-control">
              <label className="label"><span className="label-text">Email address</span></label>
              <input
                type="email"
                className="input input-bordered w-full"
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>
            <button type="submit" disabled={loading} className="btn btn-primary w-full">
              {loading ? <Loader className="w-4 h-4 animate-spin" /> : 'Send Magic Link'}
            </button>
            <p className="text-center text-sm text-base-content/60">
              <Link to="/login" className="link link-primary">Back to login</Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CheckCircle, XCircle, Loader } from 'lucide-react';
import api from '../lib/api';

export default function VerifyEmail() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('verifying'); // verifying | success | error
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('No verification token provided.');
      return;
    }

    const verify = async () => {
      try {
        await api.get(`/auth/verify?token=${token}`);
        setStatus('success');
        setTimeout(() => navigate('/login?verified=true'), 3000);
      } catch (err) {
        setStatus('error');
        setMessage(err.response?.data?.error?.message || 'Invalid or expired verification token.');
      }
    };

    verify();
  }, [token, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-base-200 px-4">
      <div className="card bg-base-100 shadow-lg max-w-md w-full p-8 text-center">
        {status === 'verifying' && (
          <>
            <Loader className="w-12 h-12 mx-auto mb-4 text-brand-vibrant animate-spin" />
            <h1 className="text-2xl font-bold mb-2">Verifying your email…</h1>
            <p className="text-base-content/60">Please wait while we verify your email address.</p>
          </>
        )}
        {status === 'success' && (
          <>
            <CheckCircle className="w-12 h-12 mx-auto mb-4 text-success" />
            <h1 className="text-2xl font-bold mb-2">Email Verified!</h1>
            <p className="text-base-content/60">Your email has been verified. Redirecting you to login…</p>
          </>
        )}
        {status === 'error' && (
          <>
            <XCircle className="w-12 h-12 mx-auto mb-4 text-error" />
            <h1 className="text-2xl font-bold mb-2">Verification Failed</h1>
            <p className="text-base-content/60 mb-4">{message}</p>
            <button onClick={() => navigate('/login')} className="btn btn-primary">
              Go to Login
            </button>
          </>
        )}
      </div>
    </div>
  );
}

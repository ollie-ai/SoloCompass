import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import api from '../lib/api';
import Button from './Button';
import Input from './Input';
import { LogIn, RefreshCw, Eye, EyeOff } from 'lucide-react';

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M17.64 9.2045C17.64 8.56636 17.5827 7.95227 17.4668 7.36364H9V10.3082H13.7309C13.5791 11.5909 13.0218 12.7364 12.1245 13.5636V15.8193H15.1036C16.7764 14.2523 17.64 11.9455 17.64 9.2045Z" fill="#4285F4"/>
    <path d="M9 18C11.43 18 13.4745 17.2045 15.1036 15.8193L12.1245 13.5636C11.3682 14.1159 10.3936 14.4545 9.31818 14.4545C6.85227 14.4545 4.81364 12.7045 4.12818 10.4282H1.07727V12.7409C2.61636 15.8282 5.88545 18 9 18Z" fill="#34A853"/>
    <path d="M4.12818 10.4282C3.93818 9.98182 3.82909 9.5 3.82909 9C3.82909 8.5 3.93818 8.01818 4.12818 7.57182V5.25909H1.07727C0.477273 6.50455 0.204545 7.89545 0.204545 9.36364C0.204545 10.8318 0.477273 12.2227 1.07727 13.4682L4.12818 10.4282Z" fill="#FBBC05"/>
    <path d="M9 3.54545C10.3218 3.54545 11.5077 3.96364 12.4409 4.92182L12.2318 4.98864C11.1036 3.88182 9.70455 3.18182 9 3.18182C5.88545 3.18182 3.19545 5.40909 1.68182 7.81818L4.14273 9.68182C4.65682 7.88636 6.36227 6.54545 9 6.54545C9.69318 6.54545 10.3591 6.70455 10.9645 7.00909L12.1427 4.93182C10.9764 3.80909 10.0618 3.54545 9 3.54545Z" fill="#EA4335"/>
  </svg>
);

/**
 * LoginForm — reusable login form component.
 *
 * Props:
 *   onSuccess(user) — called after successful login
 *   redirectPlan    — optional plan query param for checkout redirect
 */
export default function LoginForm({ onSuccess, redirectPlan }) {
  const { login, isLoading, error, clearError } = useAuthStore();
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  const resendVerification = async () => {
    if (!formData.email) {
      import('react-hot-toast').then(m => m.default.error('Please enter your email address first'));
      return;
    }
    setResending(true);
    try {
      await api.post('/auth/resend-verification', { email: formData.email });
      import('react-hot-toast').then(m => m.default.success('Verification email sent! Check your inbox.'));
      setResent(true);
    } catch (err) {
      import('react-hot-toast').then(m => m.default.error(err.response?.data?.error || 'Failed to resend verification email'));
    } finally {
      setResending(false);
    }
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.email) newErrors.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = 'Please enter a valid email';
    if (!formData.password) newErrors.password = 'Password is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    clearError();
    if (!validate()) return;
    try {
      const result = await login(formData.email, formData.password);
      onSuccess?.(result?.data?.user);
    } catch (err) {
      // error is set in authStore
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      {error && (
        <div role="alert" className="bg-error/10 border border-error/20 text-error px-4 py-3 rounded-xl text-sm font-medium">
          {error}
          {error.toLowerCase().includes('verify') && (
            <button
              type="button"
              onClick={resendVerification}
              disabled={resending || resent}
              className="ml-2 text-brand-vibrant hover:text-green-700 font-semibold flex items-center gap-1.5 mt-2 transition-colors"
            >
              <RefreshCw size={14} className={resending ? 'animate-spin' : ''} />
              {resent ? 'Email sent!' : resending ? 'Sending...' : 'Resend verification email'}
            </button>
          )}
        </div>
      )}

      <Input
        label="Email Address"
        type="email"
        name="email"
        value={formData.email}
        onChange={handleChange}
        error={errors.email}
        placeholder="you@example.com"
        autoComplete="email"
        required
      />

      <div className="space-y-1.5">
        <Input
          label="Password"
          type={showPassword ? 'text' : 'password'}
          name="password"
          value={formData.password}
          onChange={handleChange}
          error={errors.password}
          placeholder="Enter your password"
          autoComplete="current-password"
          required
          icon={
            <button
              type="button"
              onClick={() => setShowPassword(s => !s)}
              className="text-base-content/40 hover:text-base-content transition-colors p-1 -mr-1"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          }
          iconPosition="right"
        />
        <div className="flex justify-between items-center">
          <Link
            to="/magic-link"
            className="text-sm font-medium text-brand-vibrant/80 hover:text-brand-vibrant transition-colors"
          >
            Sign in with magic link
          </Link>
          <Link
            to="/forgot-password"
            className="text-sm font-medium text-brand-vibrant hover:text-green-700 transition-colors px-2 py-1 -mx-2 rounded-lg hover:bg-brand-vibrant/5"
          >
            Forgot Password?
          </Link>
        </div>
      </div>

      <Button
        type="submit"
        variant="primary"
        className="w-full py-3.5 rounded-xl font-semibold flex items-center justify-center gap-2.5 mt-6"
        disabled={isLoading}
        loading={isLoading}
      >
        {!isLoading && <><LogIn size={18} /> Sign In</>}
        {isLoading && 'Signing in...'}
      </Button>

      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-base-300/80" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-base-100/60 backdrop-blur-sm px-4 py-1 text-base-content/40 font-medium tracking-wide">or continue with</span>
        </div>
      </div>

      <a href={`${import.meta.env.VITE_API_URL || 'http://localhost:3005'}/api/auth/google`} className="w-full block">
        <Button
          variant="outline"
          className="w-full rounded-xl py-3.5 border-base-300/80 text-base-content/80 hover:bg-base-200/80 font-medium flex items-center justify-center gap-3"
        >
          <GoogleIcon />
          <span>Continue with Google</span>
        </Button>
      </a>
    </form>
  );
}

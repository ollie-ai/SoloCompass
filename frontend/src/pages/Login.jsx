import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import api from '../lib/api';
import Button from '../components/Button';
import Input from '../components/Input';
import { LogIn, RefreshCw, Eye, EyeOff, HelpCircle } from 'lucide-react';

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M17.64 9.2045C17.64 8.56636 17.5827 7.95227 17.4668 7.36364H9V10.3082H13.7309C13.5791 11.5909 13.0218 12.7364 12.1245 13.5636V15.8193H15.1036C16.7764 14.2523 17.64 11.9455 17.64 9.2045Z" fill="#4285F4"/>
    <path d="M9 18C11.43 18 13.4745 17.2045 15.1036 15.8193L12.1245 13.5636C11.3682 14.1159 10.3936 14.4545 9.31818 14.4545C6.85227 14.4545 4.81364 12.7045 4.12818 10.4282H1.07727V12.7409C2.61636 15.8282 5.88545 18 9 18Z" fill="#34A853"/>
    <path d="M4.12818 10.4282C3.93818 9.98182 3.82909 9.5 3.82909 9C3.82909 8.5 3.93818 8.01818 4.12818 7.57182V5.25909H1.07727C0.477273 6.50455 0.204545 7.89545 0.204545 9.36364C0.204545 10.8318 0.477273 12.2227 1.07727 13.4682L4.12818 10.4282Z" fill="#FBBC05"/>
    <path d="M9 3.54545C10.3218 3.54545 11.5077 3.96364 12.4409 4.92182L12.2318 4.98864C11.1036 3.88182 9.70455 3.18182 9 3.18182C5.88545 3.18182 3.19545 5.40909 1.68182 7.81818L4.14273 9.68182C4.65682 7.88636 6.36227 6.54545 9 6.54545C9.69318 6.54545 10.3591 6.70455 10.9645 7.00909L12.1427 4.93182C10.9764 3.80909 10.0618 3.54545 9 3.54545Z" fill="#EA4335"/>
  </svg>
);

const FacebookIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M22 12.07C22 6.51 17.52 2 12 2S2 6.51 2 12.07c0 5.02 3.66 9.18 8.44 9.93v-7.02H7.9v-2.9h2.54V9.86c0-2.52 1.49-3.91 3.77-3.91 1.09 0 2.23.2 2.23.2v2.48h-1.26c-1.24 0-1.63.77-1.63 1.56v1.89h2.77l-.44 2.9h-2.33V22c4.78-.75 8.44-4.91 8.44-9.93z" fill="#1877F2"/>
  </svg>
);

const AppleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M16.8 13.05c.02 2.27 1.99 3.03 2.01 3.04-.02.05-.31 1.07-1.02 2.12-.61.91-1.25 1.82-2.25 1.84-.98.02-1.3-.58-2.43-.58-1.14 0-1.49.56-2.41.6-.96.04-1.7-.96-2.32-1.87-1.26-1.82-2.22-5.15-.93-7.39.64-1.11 1.79-1.81 3.03-1.83.94-.02 1.83.63 2.43.63.6 0 1.73-.78 2.91-.67.49.02 1.88.2 2.77 1.5-.07.04-1.66.97-1.64 2.61ZM14.92 7.39c.51-.62.86-1.49.77-2.35-.73.03-1.62.49-2.14 1.11-.47.55-.88 1.44-.77 2.29.81.06 1.63-.41 2.14-1.05Z"/>
  </svg>
);

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [errors, setErrors] = useState({});
  const { isAuthenticated, login, isLoading, error, clearError, setAuthFromToken, initialized } = useAuthStore();
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3005';

  const plan = new URLSearchParams(location.search).get('plan');

  useEffect(() => {
    if (isAuthenticated) {
      const { user: refreshedUser } = useAuthStore.getState();
      if (plan && plan !== 'explorer') {
        navigate(`/checkout?plan=${plan}`, { replace: true });
      } else if (refreshedUser && !refreshedUser.quiz_completed) {
        navigate('/quiz', { replace: true });
      } else {
        navigate(from, { replace: true });
      }
    }
    
    const params = new URLSearchParams(location.search);
    if (params.get('verified') === 'true') {
      import('react-hot-toast').then(toast => {
        toast.default.success('Email verified! You can now log in to your account.', {
          duration: 6000,
          id: 'verify-success'
        });
      });
      window.history.replaceState({}, '', location.pathname);
    }
  }, [isAuthenticated, navigate, location.search]);

  // If Google OAuth redirects back with tokens in the URL, capture them and set auth state
  useEffect(() => {
    if (!initialized) return;
    const params = new URLSearchParams(location.search);
    const token = params.get('token');
    const refresh = params.get('refresh');
    const oauthError = params.get('error');
    
    if (oauthError) {
      import('react-hot-toast').then(toast => {
        toast.default.error(`Login failed: ${oauthError}`);
      });
      window.history.replaceState({}, '', location.pathname);
      return;
    }
    
    if (token && refresh) {
      window.history.replaceState({}, '', location.pathname);
      setAuthFromToken(token, refresh).then(user => {
        if (user) {
          if (plan && plan !== 'explorer') {
            navigate(`/checkout?plan=${plan}`, { replace: true });
          } else if (user && !user.quiz_completed) {
            navigate('/quiz', { replace: true });
          } else {
            navigate('/dashboard', { replace: true });
          }
        }
      });
    }
  }, [location.search, initialized, navigate, setAuthFromToken, plan]);

  const from = location.state?.from?.pathname || '/dashboard';

  const resendVerification = async () => {
    if (!formData.email) {
      import('react-hot-toast').then(toast => {
        toast.default.error('Please enter your email address first');
      });
      return;
    }
    setResending(true);
    try {
      await api.post('/auth/resend-verification', { email: formData.email });
      import('react-hot-toast').then(toast => {
        toast.default.success('Verification email sent! Check your inbox.');
      });
      setResent(true);
    } catch (err) {
      import('react-hot-toast').then(toast => {
        toast.default.error(err.response?.data?.error || 'Failed to resend verification email');
      });
    } finally {
      setResending(false);
    }
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email';
    }
    if (!formData.password) {
      newErrors.password = 'Password is required';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    clearError();
    if (!validate()) return;

    try {
      await login(formData.email, formData.password);
      navigate(from, { replace: true });
    } catch (err) {
      console.error('Login failed:', err);
      // store already set the error in useAuthStore.error
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-mesh py-12 px-4">
      <div className="max-w-md w-full animate-fade-in">
        <div className="glass-card py-10 px-8 rounded-2xl text-left relative overflow-hidden">
          <div className="absolute -top-32 -right-32 w-64 h-64 bg-gradient-to-br from-brand-vibrant/10 to-brand-accent/10 rounded-full blur-3xl"></div>
          <div className="absolute -bottom-20 -left-20 w-48 h-48 bg-brand-vibrant/5 rounded-full blur-2xl"></div>
          
          <div className="mb-8 relative z-10">
            <h2 className="text-2xl font-bold text-base-content tracking-tight">Welcome Back</h2>
            <p className="text-base-content/60 mt-1">Sign in to continue your journey.</p>
          </div>

          <form onSubmit={handleSubmit} noValidate className="space-y-5 relative z-10">
            {error && (
              <div role="alert" id="login-error" className="bg-error/10/80 backdrop-blur-sm border border-error/20 text-error px-4 py-3 rounded-xl text-sm font-medium animate-slide-up">
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
                type={showPassword ? "text" : "password"}
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
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-base-content/40 hover:text-base-content transition-colors p-1 -mr-1"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                }
                iconPosition="right"
              />
              <div className="flex justify-end">
                <Link 
                  to="/forgot-password" 
                  title="Recover your password" 
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
            
            <div className="relative my-8">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-base-300/80"></div>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-base-100/60 backdrop-blur-sm px-4 py-1 text-base-content/40 font-medium tracking-wide">or continue with</span>
              </div>
            </div>
            
            <div className="space-y-3">
              <a href={`${apiBaseUrl}/api/auth/google`} className="w-full group block">
                <Button
                  variant="outline"
                  className="w-full rounded-xl py-3.5 border-base-300/80 text-base-content/80 hover:bg-base-200/80 hover:border-base-300/70 hover:shadow-sm transition-all font-medium flex items-center justify-center gap-3"
                >
                  <GoogleIcon />
                  <span>Continue with Google</span>
                </Button>
              </a>
              <a href={`${apiBaseUrl}/api/auth/facebook`} className="w-full group block">
                <Button
                  variant="outline"
                  className="w-full rounded-xl py-3.5 border-base-300/80 text-base-content/80 hover:bg-base-200/80 hover:border-base-300/70 hover:shadow-sm transition-all font-medium flex items-center justify-center gap-3"
                >
                  <FacebookIcon />
                  <span>Continue with Facebook</span>
                </Button>
              </a>
              <a href={`${apiBaseUrl}/api/auth/apple`} className="w-full group block">
                <Button
                  variant="outline"
                  className="w-full rounded-xl py-3.5 border-base-300/80 text-base-content/80 hover:bg-base-200/80 hover:border-base-300/70 hover:shadow-sm transition-all font-medium flex items-center justify-center gap-3"
                >
                  <AppleIcon />
                  <span>Continue with Apple</span>
                </Button>
              </a>
            </div>
          </form>

          <div className="mt-8 pt-6 border-t border-base-300/50/50 text-center">
            <p className="text-base-content/60">
              New to SoloCompass?{' '}
              <Link to="/register" className="text-brand-vibrant hover:text-green-700 font-semibold transition-colors">
                Create an account
              </Link>
            </p>
          </div>

          <div className="mt-4 text-center">
            <Link 
              to="/help" 
              className="inline-flex items-center gap-1.5 text-sm text-base-content/40 hover:text-base-content transition-colors"
            >
              <HelpCircle size={14} />
              <span>Need help signing in?</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;

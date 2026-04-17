import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { trackEvent } from '../lib/telemetry';
import { useAuthStore } from '../stores/authStore';
import Button from '../components/Button';
import Input from '../components/Input';
import { UserPlus, Mail, ShieldCheck, Check, X, Eye, EyeOff, HelpCircle } from 'lucide-react';

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

const Register = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, register, isLoading, error, clearError } = useAuthStore();
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
  });
  const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3005';
  const [registeredEmail, setRegisteredEmail] = useState('');
  const plan = new URLSearchParams(location.search).get('plan');
  const referralCode = new URLSearchParams(location.search).get('ref') || '';

  useEffect(() => {
    if (isAuthenticated) {
      if (plan && plan !== 'explorer') {
        navigate(`/checkout?plan=${plan}`, { replace: true });
      } else if (useAuthStore.getState().user && !useAuthStore.getState().user.quiz_completed) {
        navigate('/quiz', { replace: true });
      } else {
        navigate('/dashboard', { replace: true });
      }
    }
  }, [isAuthenticated, navigate, plan]);

  const [dnaSyncing, setDnaSyncing] = useState(false);

  useEffect(() => {
    if (location.state?.dnaSaved) {
      setDnaSyncing(true);
    }
  }, [location.state]);
  const [errors, setErrors] = useState({});

  const checkPasswordStrength = (password) => {
    let strength = 0;
    if (password.length >= 8) strength += 25;
    if (/[A-Z]/.test(password)) strength += 25;
    if (/[0-9]/.test(password)) strength += 25;
    if (/[^A-Za-z0-9]/.test(password)) strength += 25;
    setPasswordStrength(strength);
  };

  const getStrengthColor = () => {
    if (passwordStrength <= 25) return 'bg-error/100';
    if (passwordStrength <= 50) return 'bg-orange-500';
    if (passwordStrength <= 75) return 'bg-warning/100';
    return 'bg-brand-vibrant';
  };

  const getStrengthLabel = () => {
    if (passwordStrength <= 25) return 'Weak';
    if (passwordStrength <= 50) return 'Fair';
    if (passwordStrength <= 75) return 'Good';
    return 'Strong';
  };

  const getStrengthTextColor = () => {
    if (passwordStrength <= 25) return 'text-error';
    if (passwordStrength <= 50) return 'text-orange-500';
    if (passwordStrength <= 75) return 'text-warning';
    return 'text-brand-vibrant';
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.name) {
      newErrors.name = 'Name is required';
    }
    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }
    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    } else if (!/[A-Z]/.test(formData.password)) {
      newErrors.password = 'Password must contain at least one uppercase letter';
    } else if (!/[0-9]/.test(formData.password)) {
      newErrors.password = 'Password must contain at least one number';
    } else if (!/[!@#$%^&*(),.?":{}|<>_{}[\]\\/-]/.test(formData.password)) {
      newErrors.password = 'Password must contain at least one special character';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    clearError();
    if (!validate()) return;

    try {
      await register(formData.email, formData.password, formData.name, referralCode || undefined);
      trackEvent('signup_complete', { method: 'email', hasReferral: !!referralCode });
      setRegisteredEmail(formData.email);
    } catch (err) {
      console.error('Registration failed:', err);
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
        {registeredEmail ? (
          <div className="glass-card py-12 px-8 rounded-2xl text-center relative overflow-hidden">
            <div className="absolute -top-20 -right-20 w-48 h-48 bg-gradient-to-br from-brand-vibrant/15 to-brand-accent/10 rounded-full blur-3xl"></div>
            <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-brand-vibrant/10 rounded-full blur-2xl"></div>
            
            <div className="relative z-10">
              <div className="w-20 h-20 bg-gradient-to-br from-brand-vibrant/20 to-brand-vibrant/5 rounded-2xl flex items-center justify-center mx-auto mb-8 text-brand-vibrant">
                <Mail size={40} />
              </div>
              <h2 className="text-3xl font-black text-base-content mb-4 tracking-tight">Check your inbox</h2>
              <p className="text-base-content/60 font-medium mb-8 leading-relaxed">
                We've sent a verification link to <span className="text-base-content font-bold">{registeredEmail}</span>. 
                Please click the link to activate your account.
              </p>
              <div className="space-y-4">
                <Button onClick={() => window.location.reload()} variant="outline" className="w-full rounded-xl border-base-300/80 text-base-content/60 hover:text-base-content/80">
                  Didn't get the email? Try again
                </Button>
                <Link to="/login" className="block text-brand-vibrant hover:text-green-700 font-semibold transition-colors">
                  Back to Sign In
                </Link>
              </div>
            </div>
          </div>
        ) : (
          <div className="glass-card py-10 px-8 rounded-2xl text-left relative overflow-hidden">
            <div className="absolute -top-32 -right-32 w-64 h-64 bg-gradient-to-br from-brand-vibrant/10 to-brand-accent/10 rounded-full blur-3xl"></div>
            <div className="absolute -bottom-20 -left-20 w-48 h-48 bg-brand-vibrant/5 rounded-full blur-2xl"></div>
            
            {dnaSyncing && (
              <div className="mb-8 p-5 bg-gradient-to-r from-brand-vibrant/10 to-brand-accent/5 border border-brand-vibrant/20 rounded-xl flex items-center gap-4 animate-scale-in">
                <div className="w-12 h-12 bg-brand-vibrant rounded-xl flex items-center justify-center text-white shrink-0 shadow-lg shadow-brand-vibrant/20">
                  <ShieldCheck size={24} />
                </div>
                <div>
                  <p className="text-sm font-bold text-base-content leading-tight">Travel DNA Found</p>
                  <p className="text-xs text-base-content/60 font-medium">Create your profile to secure your personalized flight paths.</p>
                </div>
              </div>
            )}

            <div className="mb-8 relative z-10">
              <h2 className="text-2xl font-bold text-base-content tracking-tight">Create Account</h2>
              <p className="text-base-content/60 mt-1">Start your solo adventure today.</p>
            </div>

            <form onSubmit={handleSubmit} noValidate className="space-y-5 relative z-10">
              {error && (
                <div role="alert" id="register-error" className="bg-error/10/80 backdrop-blur-sm border border-error/20 text-error px-4 py-3 rounded-xl text-sm font-medium animate-slide-up">
                  {error}
                </div>
              )}

              <Input
                label="Full Name"
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                error={errors.name}
                placeholder="Alex Walker"
                autoComplete="name"
                required
              />

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
                  onChange={(e) => { handleChange(e); checkPasswordStrength(e.target.value); }}
                  error={errors.password}
                  placeholder="Create a strong password"
                  autoComplete="new-password"
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
                {formData.password && (
                  <div className="space-y-3 mt-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-base-200 rounded-full overflow-hidden">
                        <div 
                          className={`h-full transition-all duration-300 ${getStrengthColor()}`}
                          style={{ width: `${passwordStrength}%` }}
                        />
                      </div>
                      <span className={`text-xs font-semibold ${getStrengthTextColor()}`}>
                        {getStrengthLabel()}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className={`flex items-center gap-1.5 ${formData.password.length >= 8 ? 'text-brand-vibrant' : 'text-base-content/40'}`}>
                        {formData.password.length >= 8 ? <Check size={12} /> : <X size={12} />} 8+ characters
                      </div>
                      <div className={`flex items-center gap-1.5 ${/[A-Z]/.test(formData.password) ? 'text-brand-vibrant' : 'text-base-content/40'}`}>
                        {/[A-Z]/.test(formData.password) ? <Check size={12} /> : <X size={12} />} Uppercase
                      </div>
                      <div className={`flex items-center gap-1.5 ${/[0-9]/.test(formData.password) ? 'text-brand-vibrant' : 'text-base-content/40'}`}>
                        {/[0-9]/.test(formData.password) ? <Check size={12} /> : <X size={12} />} Number
                      </div>
                      <div className={`flex items-center gap-1.5 ${/[^A-Za-z0-9]/.test(formData.password) ? 'text-brand-vibrant' : 'text-base-content/40'}`}>
                        {/[^A-Za-z0-9]/.test(formData.password) ? <Check size={12} /> : <X size={12} />} Special char
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-start gap-2.5 py-2">
                <div className="mt-0.5"><ShieldCheck size={14} className="text-brand-vibrant" /></div>
                <p className="text-xs text-base-content/60 leading-relaxed">
                  By signing up, you agree to our <Link to="/terms" className="text-brand-vibrant hover:underline">Terms</Link> and <Link to="/privacy" className="text-brand-vibrant hover:underline">Privacy Policy</Link>.
                </p>
              </div>

              <Button 
                type="submit" 
                variant="primary" 
                className="w-full py-3.5 rounded-xl font-semibold flex items-center justify-center gap-2.5 mt-6" 
                disabled={isLoading}
                loading={isLoading}
              >
                {!isLoading && <><UserPlus size={18} /> Get Started Free</>}
                {isLoading && 'Creating account...'}
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
                Already have an account?{' '}
                <Link to="/login" className="text-brand-vibrant hover:text-green-700 font-semibold transition-colors">
                  Sign in
                </Link>
              </p>
            </div>

            <div className="mt-4 text-center">
              <Link 
                to="/help" 
                className="inline-flex items-center gap-1.5 text-sm text-base-content/40 hover:text-base-content transition-colors"
              >
                <HelpCircle size={14} />
                <span>Need help signing up?</span>
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Register;

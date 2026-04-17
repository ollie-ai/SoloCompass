import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import Button from './Button';
import Input from './Input';
import { UserPlus, Mail, ShieldCheck, Check, X, Eye, EyeOff } from 'lucide-react';

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M17.64 9.2045C17.64 8.56636 17.5827 7.95227 17.4668 7.36364H9V10.3082H13.7309C13.5791 11.5909 13.0218 12.7364 12.1245 13.5636V15.8193H15.1036C16.7764 14.2523 17.64 11.9455 17.64 9.2045Z" fill="#4285F4"/>
    <path d="M9 18C11.43 18 13.4745 17.2045 15.1036 15.8193L12.1245 13.5636C11.3682 14.1159 10.3936 14.4545 9.31818 14.4545C6.85227 14.4545 4.81364 12.7045 4.12818 10.4282H1.07727V12.7409C2.61636 15.8282 5.88545 18 9 18Z" fill="#34A853"/>
    <path d="M4.12818 10.4282C3.93818 9.98182 3.82909 9.5 3.82909 9C3.82909 8.5 3.93818 8.01818 4.12818 7.57182V5.25909H1.07727C0.477273 6.50455 0.204545 7.89545 0.204545 9.36364C0.204545 10.8318 0.477273 12.2227 1.07727 13.4682L4.12818 10.4282Z" fill="#FBBC05"/>
    <path d="M9 3.54545C10.3218 3.54545 11.5077 3.96364 12.4409 4.92182L12.2318 4.98864C11.1036 3.88182 9.70455 3.18182 9 3.18182C5.88545 3.18182 3.19545 5.40909 1.68182 7.81818L4.14273 9.68182C4.65682 7.88636 6.36227 6.54545 9 6.54545C9.69318 6.54545 10.3591 6.70455 10.9645 7.00909L12.1427 4.93182C10.9764 3.80909 10.0618 3.54545 9 3.54545Z" fill="#EA4335"/>
  </svg>
);

const checkPasswordStrength = (password) => {
  let strength = 0;
  if (password.length >= 8) strength += 25;
  if (/[A-Z]/.test(password)) strength += 25;
  if (/[0-9]/.test(password)) strength += 25;
  if (/[^A-Za-z0-9]/.test(password)) strength += 25;
  return strength;
};

/**
 * RegisterForm — reusable registration form component with password strength meter.
 *
 * Props:
 *   onSuccess(email) — called with email after successful registration (to show verification prompt)
 *   redirectPlan     — optional plan query param
 *   dnaSyncing       — show Travel DNA syncing banner
 */
export default function RegisterForm({ onSuccess, redirectPlan, dnaSyncing = false }) {
  const { register, isLoading, error, clearError } = useAuthStore();
  const [formData, setFormData] = useState({ name: '', email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);

  const getStrengthColor = () => {
    if (passwordStrength <= 25) return 'bg-error';
    if (passwordStrength <= 50) return 'bg-orange-500';
    if (passwordStrength <= 75) return 'bg-warning';
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
    if (!formData.name) newErrors.name = 'Name is required';
    if (!formData.email) newErrors.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = 'Please enter a valid email address';
    if (!formData.password) newErrors.password = 'Password is required';
    else if (formData.password.length < 8) newErrors.password = 'Password must be at least 8 characters';
    else if (!/[A-Z]/.test(formData.password)) newErrors.password = 'Password must contain at least one uppercase letter';
    else if (!/[0-9]/.test(formData.password)) newErrors.password = 'Password must contain at least one number';
    else if (!/[!@#$%^&*(),.?":{}|<>_{}[\]\\/-]/.test(formData.password)) newErrors.password = 'Password must contain at least one special character';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    clearError();
    if (!validate()) return;
    try {
      await register(formData.email, formData.password, formData.name);
      onSuccess?.(formData.email);
    } catch (err) {
      // error set in authStore
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (name === 'password') setPasswordStrength(checkPasswordStrength(value));
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      {dnaSyncing && (
        <div className="p-5 bg-gradient-to-r from-brand-vibrant/10 to-brand-accent/5 border border-brand-vibrant/20 rounded-xl flex items-center gap-4">
          <div className="w-12 h-12 bg-brand-vibrant rounded-xl flex items-center justify-center text-white shrink-0 shadow-lg shadow-brand-vibrant/20">
            <ShieldCheck size={24} />
          </div>
          <div>
            <p className="text-sm font-bold text-base-content leading-tight">Travel DNA Found</p>
            <p className="text-xs text-base-content/60 font-medium">Create your profile to secure your personalized flight paths.</p>
          </div>
        </div>
      )}

      {error && (
        <div role="alert" className="bg-error/10 border border-error/20 text-error px-4 py-3 rounded-xl text-sm font-medium">
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
          type={showPassword ? 'text' : 'password'}
          name="password"
          value={formData.password}
          onChange={handleChange}
          error={errors.password}
          placeholder="Create a strong password"
          autoComplete="new-password"
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
        {formData.password && (
          <div className="space-y-3 mt-3">
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-base-200 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${getStrengthColor()}`}
                  style={{ width: `${passwordStrength}%` }}
                />
              </div>
              <span className={`text-xs font-semibold ${getStrengthTextColor()}`}>{getStrengthLabel()}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {[
                { test: formData.password.length >= 8, label: '8+ characters' },
                { test: /[A-Z]/.test(formData.password), label: 'Uppercase' },
                { test: /[0-9]/.test(formData.password), label: 'Number' },
                { test: /[^A-Za-z0-9]/.test(formData.password), label: 'Special char' },
              ].map(({ test, label }) => (
                <div key={label} className={`flex items-center gap-1.5 ${test ? 'text-brand-vibrant' : 'text-base-content/40'}`}>
                  {test ? <Check size={12} /> : <X size={12} />} {label}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex items-start gap-2.5 py-2">
        <div className="mt-0.5"><ShieldCheck size={14} className="text-brand-vibrant" /></div>
        <p className="text-xs text-base-content/60 leading-relaxed">
          By signing up, you agree to our{' '}
          <Link to="/terms" className="text-brand-vibrant hover:underline">Terms</Link> and{' '}
          <Link to="/privacy" className="text-brand-vibrant hover:underline">Privacy Policy</Link>.
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
          <div className="w-full border-t border-base-300/80" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-base-100/60 backdrop-blur-sm px-4 py-1 text-base-content/40 font-medium tracking-wide">or continue with</span>
        </div>
      </div>

      <a href={`${import.meta.env.VITE_API_URL || ''}/api/auth/google`} className="w-full block">
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

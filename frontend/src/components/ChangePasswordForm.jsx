import { useState } from 'react';
import { Eye, EyeOff, Lock, Loader, Check, X } from 'lucide-react';
import api from '../lib/api';
import toast from 'react-hot-toast';

const RULES = [
  { id: 'length', label: 'At least 8 characters', test: (p) => p.length >= 8 },
  { id: 'upper', label: 'One uppercase letter', test: (p) => /[A-Z]/.test(p) },
  { id: 'number', label: 'One number', test: (p) => /[0-9]/.test(p) },
  { id: 'special', label: 'One special character', test: (p) => /[!@#$%^&*(),.?":{}|<>]/.test(p) },
];

/**
 * ChangePasswordForm — standalone password change form component.
 * POSTs to PUT /api/users/me/password.
 *
 * Props:
 *   onSuccess — optional callback after successful password change
 */
export default function ChangePasswordForm({ onSuccess }) {
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [saving, setSaving] = useState(false);

  const ruleResults = RULES.map(rule => ({ ...rule, pass: rule.test(form.newPassword) }));
  const allRulesPass = ruleResults.every(r => r.pass);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!allRulesPass) {
      toast.error('New password does not meet requirements');
      return;
    }

    if (form.newPassword !== form.confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }

    setSaving(true);
    try {
      await api.put('/users/me/password', {
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      });
      toast.success('Password changed successfully');
      setForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      onSuccess?.();
    } catch (err) {
      const msg = err.response?.data?.error?.message || 'Failed to change password';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const PasswordInput = ({ label, field, show, onToggle }) => (
    <div className="form-control">
      <label className="label">
        <span className="label-text font-medium">{label}</span>
      </label>
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          className="input input-bordered w-full pr-10"
          value={form[field]}
          onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
          placeholder="••••••••"
          required
        />
        <button
          type="button"
          className="absolute right-3 top-1/2 -translate-y-1/2 text-base-content/40 hover:text-base-content transition-colors"
          onClick={onToggle}
          tabIndex={-1}
        >
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PasswordInput
        label="Current Password"
        field="currentPassword"
        show={showCurrent}
        onToggle={() => setShowCurrent(s => !s)}
      />

      <PasswordInput
        label="New Password"
        field="newPassword"
        show={showNew}
        onToggle={() => setShowNew(s => !s)}
      />

      {/* Password requirements */}
      {form.newPassword.length > 0 && (
        <ul className="space-y-1">
          {ruleResults.map(r => (
            <li key={r.id} className={`flex items-center gap-2 text-xs ${r.pass ? 'text-success' : 'text-base-content/50'}`}>
              {r.pass ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
              {r.label}
            </li>
          ))}
        </ul>
      )}

      <PasswordInput
        label="Confirm New Password"
        field="confirmPassword"
        show={showNew}
        onToggle={() => setShowNew(s => !s)}
      />

      {form.confirmPassword.length > 0 && form.newPassword !== form.confirmPassword && (
        <p className="text-xs text-error flex items-center gap-1">
          <X className="w-3 h-3" /> Passwords do not match
        </p>
      )}

      <div className="flex justify-end pt-2">
        <button
          type="submit"
          disabled={saving || !allRulesPass || form.newPassword !== form.confirmPassword || !form.currentPassword}
          className="btn btn-primary gap-2"
        >
          {saving ? <Loader className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
          Update Password
        </button>
      </div>
    </form>
  );
}

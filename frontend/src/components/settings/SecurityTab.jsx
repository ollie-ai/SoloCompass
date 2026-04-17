import { motion } from 'framer-motion';
import { KeyRound, Lock, Monitor, LogOut, Globe, Smartphone, Fingerprint, CheckCircle } from 'lucide-react';
import Input from '../Input';

const EASE = [0.16, 1, 0.3, 1];
const cardClass = "glass-card p-6 rounded-3xl border border-base-300/50";

const SecurityTab = ({
  saving,
  passwordData,
  setPasswordData,
  handlePasswordChange,
  handleLogoutOtherDevices,
  user,
}) => {
  return (
    <motion.div
      key="security"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ ease: EASE, duration: 0.25 }}
      className="space-y-6"
    >
      <div>
        <h2 className="text-xl font-black text-base-content">Security</h2>
        <p className="text-base-content/60 font-medium text-sm mt-1">Manage your password, sessions, and sign-in methods.</p>
      </div>

      <div className={`${cardClass} p-5 flex items-start gap-5 bg-gradient-to-br from-green-50 to-emerald-50 border-green-100`}>
        <div className="w-12 h-12 rounded-2xl bg-base-100 flex items-center justify-center shrink-0 shadow-sm shadow-green-200/50">
          <CheckCircle size={24} className="text-emerald-500" />
        </div>
        <div className="min-w-0">
          <p className="font-black text-base-content">Account Status: Protected</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-2">
            <div className="flex items-center gap-1.5 text-xs text-success font-bold">
              <div className="w-1.5 h-1.5 rounded-full bg-success" />
              Email Verified
            </div>
            <div className="flex items-center gap-1.5 text-xs text-success font-bold">
              <div className="w-1.5 h-1.5 rounded-full bg-success" />
              Single Authentication Active
            </div>
          </div>
        </div>
      </div>

      <div className={cardClass}>
        <div className="p-6 border-b border-base-300/50">
          <h3 className="text-lg font-black text-base-content flex items-center gap-2">
            <KeyRound size={18} className="text-brand-vibrant" /> Change Password
          </h3>
        </div>
        <div className="p-6">
          <form onSubmit={handlePasswordChange} className="space-y-5">
            <Input
              label="Current Password"
              type="password"
              value={passwordData.currentPassword}
              onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
              placeholder="Enter current password"
            />
            <div className="grid sm:grid-cols-2 gap-5">
              <Input
                label="New Password"
                type="password"
                value={passwordData.newPassword}
                onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                placeholder="At least 8 characters"
              />
              <Input
                label="Confirm New Password"
                type="password"
                value={passwordData.confirmPassword}
                onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                placeholder="Repeat new password"
              />
            </div>
            <p className="text-xs text-base-content/60 font-medium">Use at least 8 characters, including a number and a symbol.</p>
            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 bg-brand-vibrant text-white shadow-lg shadow-brand-vibrant/20 hover:bg-green-600 disabled:opacity-30 rounded-xl font-black px-6 py-2.5 text-xs uppercase tracking-tight transition-all"
              >
                <Lock size={14} />
                {saving ? 'UPDATING...' : 'Update Password'}
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className={cardClass}>
        <div className="p-6 border-b border-base-300/50">
          <h3 className="text-lg font-black text-base-content flex items-center gap-2">
            <Monitor size={18} className="text-brand-vibrant" /> Active Sessions
          </h3>
        </div>
        <div className="p-6">
          <div className="flex items-center justify-between p-4 rounded-xl bg-base-200 border border-base-300/50">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-brand-vibrant/10 flex items-center justify-center">
                <Monitor size={16} className="text-brand-vibrant" />
              </div>
              <div>
                <p className="text-sm font-bold text-base-content">Current device</p>
                <p className="text-xs text-base-content/60 font-medium">This browser — active now</p>
              </div>
            </div>
            <span className="text-xs font-bold text-brand-vibrant bg-brand-vibrant/10 px-2.5 py-1 rounded-full">Current</span>
          </div>
          <div className="mt-4">
            <button
              type="button"
              onClick={handleLogoutOtherDevices}
              className="inline-flex items-center gap-2 text-sm text-base-content/80 hover:text-brand-vibrant font-bold transition-colors"
            >
              <LogOut size={14} /> Log out other devices
            </button>
            <p className="text-xs text-base-content/60 font-medium mt-2">If anything looks unfamiliar, log out other devices immediately.</p>
          </div>
        </div>
      </div>

      <div className={cardClass}>
        <div className="p-6 border-b border-base-300/50">
          <h3 className="text-lg font-black text-base-content flex items-center gap-2">
            <Fingerprint size={18} className="text-brand-vibrant" /> Sign-In Methods
          </h3>
        </div>
        <div className="p-6 space-y-3">
          <div className="flex items-center justify-between p-4 rounded-xl bg-base-200 border border-base-300/50">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-base-100 border border-base-300 flex items-center justify-center">
                <Lock size={16} className="text-base-content/40" />
              </div>
              <div>
                <p className="text-sm font-bold text-base-content italic opacity-60">Email Auth</p>
                <p className="text-xs text-base-content font-bold">{user?.email}</p>
              </div>
            </div>
            <span className="text-[10px] font-black text-success bg-success/10 px-2.5 py-1 rounded-full uppercase tracking-tighter">Active</span>
          </div>
          <div className="flex items-center justify-between p-4 rounded-xl bg-base-200 border border-base-300/50 group opacity-70">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-base-100 border border-base-300 flex items-center justify-center">
                <Globe size={16} className="text-base-content/40" />
              </div>
              <div>
                <p className="text-sm font-bold text-base-content">Social Sign-In: Google</p>
                <p className="text-xs text-base-content/60 font-medium italic">OAuth provider not connected</p>
              </div>
            </div>
            <span className="text-[10px] font-black text-base-content/40 bg-base-200 px-2.5 py-1 rounded-full uppercase tracking-tighter">Off</span>
          </div>
          <div className="flex items-center justify-between p-4 rounded-xl bg-base-200 border border-base-300/50 opacity-60">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-base-300 flex items-center justify-center">
                <Smartphone size={16} className="text-base-content/60" />
              </div>
              <div>
                <p className="text-sm font-bold text-base-content">GitHub</p>
                <p className="text-xs text-base-content/60 font-medium">Not available</p>
              </div>
            </div>
            <span className="text-xs font-bold text-base-content/40 bg-base-200 px-2.5 py-1 rounded-full">Unavailable</span>
          </div>
        </div>
      </div>

      <div className={`${cardClass} p-5 border-dashed border-base-300/70`}>
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-base-200 flex items-center justify-center shrink-0">
            <Lock size={18} className="text-base-content/40" />
          </div>
          <div>
            <p className="font-bold text-base-content">Two-factor authentication</p>
            <p className="text-sm text-base-content/60 font-medium mt-1">Coming later — we'll notify you when it's available.</p>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default SecurityTab;

import { motion } from 'framer-motion';
import { User, MapPin, Shield, Sparkles, RotateCcw, Save, Check, Camera, ShieldCheck, Phone, Fingerprint } from 'lucide-react';
import Input from '../Input';
import SoloIDCard from '../SoloIDCard';
import { ACTIVITY_INTERESTS, VIBE_INTERESTS } from '../../constants/interests';
import api from '../../lib/api';
import toast from 'react-hot-toast';

const EASE = [0.16, 1, 0.3, 1];
const cardClass = "glass-card p-6 rounded-3xl border border-base-300/50";

const ProfileTab = ({
  formData,
  setFormData,
  user,
  saving,
  hasUnsavedChanges,
  handleProfileUpdate,
  soloId,
  uploading,
  fileInputRef,
  handleAvatarClick,
  handleFileChange,
  toggleInterest,
  previewSoloId,
  navigate,
  setShowVerificationModal,
  lastSaved,
}) => {
  return (
    <motion.div
      key="profile"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ ease: EASE, duration: 0.25 }}
      className="space-y-6"
    >
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-black text-base-content flex items-center gap-2">
          <User size={20} className="text-brand-vibrant" /> Account Profile
        </h2>
        <p className="text-base-content/60 font-medium text-sm">Manage your private identity and core account details.</p>
      </div>

      <div className={cardClass}>
        <div className="p-6 border-b border-base-300/50 flex items-center justify-between">
          <h3 className="text-base font-black text-base-content flex items-center gap-2">
            Core Identity
          </h3>
          <div className="px-2.5 py-0.5 rounded-full bg-slate-100 text-[10px] font-black text-slate-500 uppercase tracking-widest">
            Private
          </div>
        </div>
        <div className="p-6">
          <form onSubmit={handleProfileUpdate} className="space-y-6">
            <div className="flex items-center gap-5 mb-4 p-4 rounded-2xl bg-base-200/50 border border-base-300/30">
              <div className="relative group">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/*"
                  className="hidden"
                />
                <div
                  onClick={handleAvatarClick}
                  className={`w-20 h-20 rounded-2xl bg-gradient-to-br from-brand-vibrant to-emerald-500 p-0.5 shadow-lg shadow-brand-vibrant/10 transition-transform group-hover:scale-105 cursor-pointer ${uploading ? 'animate-pulse' : ''}`}
                >
                  <div className="w-full h-full rounded-[14px] bg-slate-900 flex items-center justify-center overflow-hidden relative">
                    {soloId?.avatarUrl ? (
                      <img src={soloId.avatarUrl} alt={soloId.name || "Profile avatar"} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-2xl font-black text-white">{(formData.name || user?.email || '?').charAt(0).toUpperCase()}</span>
                    )}
                    {uploading && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <RotateCcw size={20} className="text-white animate-spin" />
                      </div>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleAvatarClick}
                  className="absolute -bottom-1 -right-1 p-1.5 rounded-lg bg-brand-vibrant text-white shadow-lg border-2 border-base-100 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Camera size={12} />
                </button>
              </div>
              <div className="min-w-0">
                <p className="font-bold text-base-content text-lg truncate">{formData.name || 'Set your name'}</p>
                <p className="text-sm text-base-content/50 font-medium truncate mb-2">{user?.email}</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleAvatarClick}
                    disabled={uploading}
                    className="text-[10px] font-black text-brand-vibrant uppercase tracking-tight px-3 py-1 rounded-lg bg-brand-vibrant/5 hover:bg-brand-vibrant/10 transition-colors disabled:opacity-50"
                  >
                    {uploading ? 'Uploading...' : 'Change Photo'}
                  </button>
                </div>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-5">
              <Input
                label="Preferred Display Name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Alex"
                desc="Used across the app and as default for buddy profile."
              />
              <Input
                label="Email (Account ID)"
                value={user?.email || ''}
                disabled
                desc="Cannot be changed via this form."
              />
            </div>

            <Input
              label="Home base (City)"
              value={formData.home_city}
              onChange={(e) => setFormData({ ...formData, home_city: e.target.value })}
              placeholder="e.g. London, United Kingdom"
              icon={<MapPin size={18} />}
              desc="Used for context in your buddy matches."
            />

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={saving || !hasUnsavedChanges}
                className="inline-flex items-center gap-2 bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed rounded-xl font-bold px-6 py-2.5 transition-all shadow-xl shadow-slate-900/10"
              >
                {saving ? <RotateCcw size={16} className="animate-spin" /> : <Save size={16} />}
                {saving ? 'Saving...' : 'Save Profile'}
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className={cardClass}>
        <div className="p-6 border-b border-base-300/50 flex items-center justify-between">
          <h3 className="text-base font-black text-base-content flex items-center gap-2">
            Travel DNA
          </h3>
          <div className="px-2.5 py-0.5 rounded-full bg-brand-vibrant/10 text-[10px] font-black text-brand-vibrant uppercase tracking-widest">
            Shared
          </div>
        </div>
        <div className="p-6">
          {soloId?.travelDna ? (
            <div className="space-y-6">
              <div className="p-5 rounded-2xl bg-brand-vibrant/5 border border-brand-vibrant/10 flex flex-col sm:flex-row items-center gap-6">
                <div className="w-16 h-16 rounded-2xl bg-white flex items-center justify-center shrink-0 shadow-sm border border-brand-vibrant/20">
                  <Fingerprint size={32} className="text-brand-vibrant" />
                </div>
                <div className="flex-1 text-center sm:text-left min-w-0">
                  <p className="text-xs font-black text-brand-vibrant uppercase tracking-widest mb-1">Your DNA Vibe</p>
                  <h4 className="text-2xl font-black text-slate-900 capitalize leading-none mb-2">{soloId.travelDna.style}</h4>
                  <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-900 text-white">Social: {soloId.travelDna.socialStyle}</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-900 text-white">Adventure: {soloId.travelDna.adventureLevel}</span>
                  </div>
                </div>
                <button
                  onClick={() => navigate('/quiz')}
                  className="px-4 py-2 bg-white border border-slate-200 text-slate-900 hover:bg-slate-50 rounded-xl font-bold text-xs transition-all shadow-sm whitespace-nowrap"
                >
                  Retake Quiz
                </button>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-base-content/40 uppercase tracking-widest">Public Interests</h4>
                  <span className="text-[10px] font-bold text-brand-vibrant">{formData.interests?.length || 0} selected</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {VIBE_INTERESTS.concat(ACTIVITY_INTERESTS).map((interest) => (
                    <button
                      key={interest.value}
                      type="button"
                      onClick={() => toggleInterest(interest.value)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-[10px] font-bold transition-all ${formData.interests?.includes(interest.value)
                        ? 'bg-brand-vibrant/10 border-brand-vibrant text-brand-vibrant shadow-sm shadow-brand-vibrant/10'
                        : 'bg-base-100 border-base-300/60 text-base-content/60 hover:border-base-content/20'
                        }`}
                    >
                      <interest.icon size={12} />
                      <span className="truncate">{interest.value}</span>
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-base-content/40 font-medium italic">Select at least 3 interests to increase your match accuracy.</p>
              </div>
            </div>
          ) : (
            <div className="p-5 rounded-2xl bg-base-200/50 border border-dashed border-base-300 text-center">
              <p className="text-sm font-bold text-base-content/60 mb-3">You haven't discovered your Travel DNA yet.</p>
              <button
                onClick={() => navigate('/quiz')}
                className="px-6 py-2 bg-brand-vibrant text-white rounded-xl font-bold text-sm shadow-lg shadow-brand-vibrant/20"
              >
                Start Discovery Quiz
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className={cardClass}>
          <div className="p-6 border-b border-base-300/50 flex items-center justify-between">
            <h3 className="text-base font-black text-base-content flex items-center gap-2">
              Safety Contact
            </h3>
            <Shield size={16} className="text-blue-500" />
          </div>
          <div className="p-6 space-y-4">
            <Input
              label="Secondary Phone Number"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="+1 (555) 000-0000"
              icon={<Phone size={16} />}
            />
            <div className="flex items-center justify-between">
              <div className="p-3 bg-blue-50/50 border border-blue-100 rounded-xl flex-1 mr-3">
                <p className="text-[10px] leading-relaxed text-blue-700/80 font-bold">
                  Private: only used for safety check-ins. Never shown to others.
                </p>
              </div>
              {formData.phone && (
                <button
                  onClick={async () => {
                    try {
                      const res = await api.post('/verification/verify-phone', { phone: formData.phone });
                      if (res.data.success) {
                        toast.success('Verification code sent!');
                      } else {
                        toast.error('Failed to send code');
                      }
                    } catch (err) {
                      toast.error('Verification failed');
                    }
                  }}
                  className="px-3 py-2 bg-brand-vibrant text-white rounded-lg text-xs font-bold hover:bg-emerald-600 transition-colors"
                >
                  Verify
                </button>
              )}
            </div>
          </div>
        </div>

        <div className={cardClass}>
          <div className="p-6 border-b border-base-300/50 flex items-center justify-between">
            <h3 className="text-base font-black text-base-content flex items-center gap-2">
              Your Public Persona
            </h3>
            <p className="text-[10px] font-bold text-indigo-600/60 uppercase tracking-widest mt-0.5">Visible to other travellers</p>
          </div>
          <div className="p-6">
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="scale-75 origin-top -mb-16 -mt-8">
                <SoloIDCard data={previewSoloId} />
              </div>
              <div className="space-y-3 z-10 w-full mt-4">
                <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-100/50 text-left">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-black text-indigo-700 uppercase tracking-widest flex items-center gap-1.5">
                      <ShieldCheck size={12} /> Basic Verification
                    </span>
                    <span className="text-[10px] font-black text-slate-500">Tier 1</span>
                  </div>
                  <p className="text-[10px] font-bold text-indigo-900/60 leading-relaxed">
                    Your profile is basic. Verify your identity in Buddies to build more community trust.
                  </p>
                </div>

                <div className="flex items-center justify-between text-[10px] font-bold text-base-content/40 uppercase tracking-widest">
                  <span>Completeness</span>
                  <span className="text-brand-vibrant">{soloId?.completeness?.percentage || 0}%</span>
                </div>
                <div className="w-full h-1 bg-base-200 rounded-full overflow-hidden">
                  <div className="h-full bg-brand-vibrant transition-all duration-1000" style={{ width: `${soloId?.completeness?.percentage || 0}%` }} />
                </div>
                <button
                  onClick={() => setShowVerificationModal(true)}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-slate-900 text-white text-xs font-black hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/10"
                >
                  <Sparkles size={14} className="text-brand-vibrant" /> Enhance My Persona
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {hasUnsavedChanges && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="sticky bottom-4 z-10"
        >
          <div className={`${cardClass} p-4 flex items-center justify-between`}>
            <div className="flex items-center gap-2 text-sm">
              <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              <span className="text-base-content/80 font-medium">Unsaved changes</span>
            </div>
            <button
              onClick={handleProfileUpdate}
              disabled={saving}
              className="inline-flex items-center gap-2 bg-brand-vibrant text-white shadow-md shadow-brand-vibrant/25 hover:bg-green-600 disabled:opacity-50 rounded-xl font-bold px-5 py-2 text-sm transition-all"
            >
              <Save size={14} /> Save changes
            </button>
          </div>
        </motion.div>
      )}

      {lastSaved && !hasUnsavedChanges && (
        <div className="flex items-center gap-2 text-xs text-base-content/40 font-medium">
          <Check size={12} /> Saved just now
        </div>
      )}
    </motion.div>
  );
};

export default ProfileTab;

import { useState, useEffect, useMemo, useRef } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useAuthStore } from '../stores/authStore';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Skeleton from '../components/Skeleton';
import api from '../lib/api';
import toast from 'react-hot-toast';
import { User, Shield, Bell, CreditCard, Zap } from 'lucide-react';
import VerificationModal from '../components/VerificationModal';
import DashboardShell from '../components/dashboard/DashboardShell';
import PageHeader from '../components/PageHeader';
import ConfirmDialog from '../components/ConfirmDialog';
import SEO from '../components/SEO';

const EASE = [0.16, 1, 0.3, 1];
const cardClass = "glass-card p-6 rounded-3xl border border-base-300/50";

const Settings = () => {
  const { user, updateUser, logout, refreshUser, initialized } = useAuthStore();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState('profile');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    home_city: '',
    bio: '',
    travel_style: 'moderate',
    interests: [],
  });
  const [soloId, setSoloId] = useState(null);
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);
  const [initialFormData, setInitialFormData] = useState(null);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [subscriptionStatus, setSubscriptionStatus] = useState(null);
  const [loadingSubscription, setLoadingSubscription] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState({ open: false, action: null });
  const defaultNotifPrefs = {
    emailNotifications: true,
    pushNotifications: true,
    smsNotifications: false,
    checkinReminders: true,
    checkinMissed: true,
    checkinEmergency: true,
    tripReminders: true,
    buddyRequests: true,
    budgetAlerts: true,
    reminderMinutesBefore: 15
  };

  const [notifPrefs, setNotifPrefs] = useState({ ...defaultNotifPrefs });
  const [savingNotifPrefs, setSavingNotifPrefs] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [showAccountDeletionModal, setShowAccountDeletionModal] = useState(false);

  useEffect(() => {
    if (initialized && user?.id) {
      fetchUser();
      fetchSubscriptionStatus();
      fetchNotifPrefs();
      fetchSoloId();
    }
  }, [user?.id, initialized]);

  useEffect(() => {
    if (searchParams.get('tab') === 'notifications') {
      setActiveTab('notifications');
    }

    if (searchParams.get('payment') === 'success') {
      toast.success('Subscription activated! Welcome to SoloCompass Premium.');
      refreshUser();
      navigate('/settings?tab=billing', { replace: true });
    } else if (searchParams.get('payment') === 'cancel') {
      toast.error('Payment was cancelled. Your plan has not changed.');
      navigate('/settings?tab=billing', { replace: true });
    }
  }, [searchParams]);

  const fetchUser = async () => {
    if (!user?.id) return;
    try {
      setLoading(true);

      const response = await api.get(`/users/${user.id}`);
      const userData = response.data.data.user;
      const newFormData = {
        name: userData.name || '',
        bio: userData.bio || '',
        phone: userData.phone || '',
        home_city: userData.home_city || '',
        travel_style: userData.travel_style || 'moderate',
        interests: userData.interests || [],
      };
      setFormData(newFormData);
      setInitialFormData(newFormData);
    } catch (err) {
      console.error('Failed to fetch user:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSoloId = async () => {
    try {
      const res = await api.get('/matching/solo-id');
      setSoloId(res.data.data);
    } catch (err) {
      console.error('Failed to fetch Solo ID:', err);
    }
  };

  const fetchSubscriptionStatus = async () => {
    try {
      const response = await api.get('/billing/subscription-status');
      setSubscriptionStatus(response.data.data);
    } catch (err) {
      console.error('Failed to fetch subscription status:', err);
    }
  };

  const fetchNotifPrefs = async () => {
    try {
      const res = await api.get('/notifications/preferences');
      if (res.data.success) {
        setNotifPrefs(res.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch notification preferences:', err);
    }
  };

  const handleSaveNotifPrefs = async () => {
    setSavingNotifPrefs(true);
    try {
      const res = await api.put('/notifications/preferences', notifPrefs);
      if (res.data.success) {
        toast.success('Notification preferences saved');
        setLastSaved(new Date());
      } else {
        toast.error(res.data.error || 'Failed to save');
      }
    } catch (err) {
      console.error('Save prefs error:', err);
      toast.error(err.response?.data?.error || 'Failed to save notification preferences');
    } finally {
      setTimeout(() => setSavingNotifPrefs(false), 500);
    }
  };

  const handleResetNotifPrefs = () => {
    setNotifPrefs({ ...defaultNotifPrefs });
    toast.success('Reset to default preferences');
  };

  const handleCancelSubscription = () => {
    setConfirmDialog({
      open: true,
      action: 'cancel_subscription',
    });
  };

  const executeCancelSubscription = async () => {
    setLoadingSubscription(true);
    try {
      await api.post('/billing/cancel-subscription');
      toast.success('Subscription cancelled. You will retain access until the end of your billing period.');
      await refreshUser();
      await fetchSubscriptionStatus();
    } catch (err) {
      toast.error(err.response?.data?.error?.message || err.response?.data?.error || 'Failed to cancel subscription');
    } finally {
      setLoadingSubscription(false);
      setConfirmDialog({ open: false, action: null });
    }
  };

  const handleAvatarClick = () => {
    if (uploading) return;
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error('File size too large (max 2MB)');
      return;
    }

    setUploading(true);
    const uploadData = new FormData();
    uploadData.append('avatar', file);

    try {
      // 1. Upload to matching service
      const res = await api.post('/matching/avatar/upload', uploadData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (res.data.success) {
        const newAvatarUrl = res.data.data.avatarUrl;

        // 2. Parallel update to both tables for instant consistency
        await Promise.all([
          api.put('/matching/profile', { avatarUrl: newAvatarUrl }),
          api.put(`/users/${user?.id}`, { avatar_url: newAvatarUrl })
        ]);

        // 3. Update local state
        setSoloId(prev => ({ ...prev, avatarUrl: newAvatarUrl }));
        setFormData(prev => ({ ...prev, avatar_url: newAvatarUrl }));

        toast.success('Avatar updated successfully');
        refreshUser();
      }
    } catch (err) {
      console.error('Avatar upload error:', err);
      toast.error('Failed to upload avatar');
    } finally {
      setUploading(false);
    }
  };

  const toggleInterest = (interest) => {
    setFormData(prev => ({
      ...prev,
      interests: prev.interests.includes(interest)
        ? prev.interests.filter(i => i !== interest)
        : [...prev.interests, interest]
    }));
  };

  const previewSoloId = useMemo(() => {
    if (!soloId) return null;
    return {
      ...soloId,
      name: formData.name || soloId.name,
      displayName: formData.name || soloId.displayName,
      homeCity: formData.home_city || soloId.homeCity,
      bio: formData.bio || soloId.bio,
      interests: formData.interests || soloId.interests,
    };
  }, [soloId, formData]);

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    if (formData.phone && formData.phone.length > 0 && !/^\+?[0-9\s\-()\.]{7,20}$/.test(formData.phone)) {
      setError('Please enter a valid phone number');
      setSaving(false);
      return;
    }

    try {
      // Execute both updates in parallel for atomic-like visibility
      const [userRes] = await Promise.all([
        // 1. Core User & Profile Data (Name, Phone, Bio, Home City)
        api.put(`/users/${user?.id}`, {
          name: formData.name,
          phone: formData.phone,
          bio: formData.bio,
          home_city: formData.home_city,
          interests: formData.interests
        }),
        // 2. Matching Engine Metadata (Syncing relevant fields)
        api.put('/matching/profile', {
          displayName: formData.name,
          bio: formData.bio,
          home_city: formData.home_city,
          interests: formData.interests
        })
      ]);

      updateUser(userRes.data.data.user);
      await fetchSoloId();
      setInitialFormData({ ...formData });
      setLastSaved(new Date());
      setSuccess('Profile identity unified and saved');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Profile update error:', err);
      setError(err.response?.data?.error || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setError('New passwords do not match');
      setSaving(false);
      return;
    }

    if (passwordData.newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      setSaving(false);
      return;
    }

    try {
      await api.put(`/users/${user?.id}`, {
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword,
      });
      setSuccess('Password changed successfully');
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to change password');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAccount = () => {
    setConfirmDialog({ open: true, action: 'delete_account' });
  };

  const executeDeleteAccount = async () => {
    setSaving(true);
    try {
      await api.delete(`/users/${user?.id}`);
      setConfirmDialog({ open: false, action: null });
      await logout();
      navigate('/');
      import('react-hot-toast').then(toast => toast.default.success('Your account has been deleted.'));
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete account');
    } finally {
      setSaving(false);
      setConfirmDialog({ open: false, action: null });
    }
  };

  const [exporting, setExporting] = useState(false);
  const handleExportData = async () => {
    setExporting(true);
    try {
      const response = await api.get('/account/data-export', { responseType: 'blob' });
      const blob = new Blob([response.data], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `solocompass-data-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      import('react-hot-toast').then(toast => toast.default.success('Data archive generated successfully!'));
    } catch (err) {
      import('react-hot-toast').then(toast => toast.default.error('Failed to generate archive.'));
    } finally {
      setExporting(false);
    }
  };

  const handleLogoutOtherDevices = async () => {
    try {
      await api.post('/auth/logout-other-devices');
      toast.success('Logged out all other devices');
    } catch (err) {
      toast.error('Failed to log out other devices');
    }
  };

  const hasUnsavedChanges = useMemo(() => {
    if (!initialFormData) return false;
    return Object.keys(initialFormData).some(key => formData[key] !== initialFormData[key]);
  }, [formData, initialFormData]);

  if (loading) return (
    <DashboardShell>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-12">
          <Skeleton className="h-4 w-32 mb-4" />
          <Skeleton className="h-12 w-64 mb-4" />
          <Skeleton className="h-6 w-96 font-medium" />
        </div>
        <div className="grid lg:grid-cols-[280px_1fr] gap-10">
          <div className="space-y-4">
            <div className="glass-card h-64 rounded-3xl animate-pulse" />
          </div>
          <div className="space-y-8">
            <div className="glass-card h-96 rounded-3xl animate-pulse" />
            <div className="glass-card h-64 rounded-3xl animate-pulse" />
          </div>
        </div>
      </div>
    </DashboardShell>
  );

  const tabs = [
    { id: 'profile', label: 'Profile & Preferences', icon: User, desc: 'Manage your personal identity' },
    { id: 'security', label: 'Security', icon: Shield, desc: 'Protect your account' },
    { id: 'notifications', label: 'Notifications', icon: Bell, desc: 'Communication preferences' },
    { id: 'billing', label: 'Billing & Data', icon: CreditCard, desc: 'Plans, Export, and Privacy' },
  ];

  return (
    <DashboardShell>
      <SEO
        title="Account Settings"
        description="Manage your SoloCompass profile, security, notifications, and billing preferences."
      />

      {/* Cancel Subscription dialog */}
      <ConfirmDialog
        open={confirmDialog.open && confirmDialog.action === 'cancel_subscription'}
        onConfirm={executeCancelSubscription}
        onCancel={() => setConfirmDialog({ open: false, action: null })}
        title="Cancel Subscription?"
        description="You will lose access to premium features at the end of your current billing period. This cannot be undone until you re-subscribe."
        confirmLabel="Yes, Cancel"
        cancelLabel="Keep Subscription"
        variant="warning"
        loading={loadingSubscription}
      />

      {/* Delete Account dialog */}
      <ConfirmDialog
        open={confirmDialog.open && confirmDialog.action === 'delete_account'}
        onConfirm={executeDeleteAccount}
        onCancel={() => setConfirmDialog({ open: false, action: null })}
        title="Permanently Delete Account?"
        description="This will permanently delete your SoloCompass account and ALL associated trip data, itineraries, and account information. This action CANNOT be undone."
        confirmLabel="Delete My Account"
        cancelLabel="Keep Account"
        variant="danger"
        loading={saving}
      />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-12">
          <PageHeader
            title={<>Control <span className="text-gradient">Centre</span></>}
            subtitle="Manage your global identity, security protocols, and mission data."
            badge="Root Access"
            icon={Shield}
          />
        </div>

        <div className="grid lg:grid-cols-[280px_1fr] gap-8 lg:gap-12 items-start">
          <div className="space-y-4 sticky top-24">
            <div className="glass-card-dark p-2 rounded-3xl border-white/5 shadow-2xl">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl font-black transition-all text-left group ${activeTab === tab.id
                    ? 'bg-brand-vibrant text-white shadow-lg shadow-brand-vibrant/20 scale-[1.02]'
                    : 'text-base-content/40 hover:text-base-content/70 hover:bg-white/5'
                    }`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-110 ${activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-white/5 text-base-content/30'
                    }`}>
                    <tab.icon size={20} strokeWidth={activeTab === tab.id ? 3 : 2} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] uppercase tracking-premium leading-none">{tab.label.split(' ')[0]}</p>
                    <p className={`text-[13px] font-black mt-1.5 tracking-tight truncate ${activeTab === tab.id ? 'text-white' : 'text-base-content/20 group-hover:text-base-content/40'}`}>
                      {tab.label.split(' ').slice(1).join(' ') || tab.label}
                    </p>
                  </div>
                </button>
              ))}
            </div>

            <div className="glass-card p-6 rounded-3xl border-brand-vibrant/10 bg-brand-vibrant/5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-lg bg-brand-vibrant/10 flex items-center justify-center">
                  <Zap size={16} className="text-brand-vibrant" />
                </div>
                <h4 className="font-outfit font-black text-xs text-brand-vibrant uppercase tracking-widest">Premium Status</h4>
              </div>
              <p className="text-[11px] font-bold text-base-content/60 uppercase leading-relaxed">
                {user?.isPremium ? 'Authorized for Navigator tier operations.' : 'Explore basic mission parameters. Upgrade for full access.'}
              </p>
            </div>
          </div>

          <div className="min-w-0">
            <AnimatePresence mode="wait">
              {activeTab === 'profile' && (
                <ProfileTab
                  formData={formData}
                  setFormData={setFormData}
                  user={user}
                  saving={saving}
                  hasUnsavedChanges={hasUnsavedChanges}
                  handleProfileUpdate={handleProfileUpdate}
                  soloId={soloId}
                  uploading={uploading}
                  fileInputRef={fileInputRef}
                  handleAvatarClick={handleAvatarClick}
                  handleFileChange={handleFileChange}
                  toggleInterest={toggleInterest}
                  previewSoloId={previewSoloId}
                  navigate={navigate}
                  setShowVerificationModal={setShowVerificationModal}
                  lastSaved={lastSaved}
                />
              )}

              {activeTab === 'security' && (
                <SecurityTab
                  saving={saving}
                  passwordData={passwordData}
                  setPasswordData={setPasswordData}
                  handlePasswordChange={handlePasswordChange}
                  handleLogoutOtherDevices={handleLogoutOtherDevices}
                  user={user}
                />
              )}

              {activeTab === 'notifications' && (
                <NotificationsTab
                  notifPrefs={notifPrefs}
                  setNotifPrefs={setNotifPrefs}
                  savingNotifPrefs={savingNotifPrefs}
                  handleSaveNotifPrefs={handleSaveNotifPrefs}
                  handleResetNotifPrefs={handleResetNotifPrefs}
                />
              )}

              {activeTab === 'billing' && (
                <BillingTab
                  subscriptionStatus={subscriptionStatus}
                  loadingSubscription={loadingSubscription}
                  handleCancelSubscription={handleCancelSubscription}
                  navigate={navigate}
                  saving={saving}
                  exporting={exporting}
                  handleExportData={handleExportData}
                  handleDeleteAccount={handleDeleteAccount}
                />
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
      <AccountDeletionModal
        isOpen={showAccountDeletionModal}
        isDeleting={saving}
        onClose={() => !saving && setShowAccountDeletionModal(false)}
        onConfirm={handleDeleteAccount}
      />
    </DashboardShell>
  );
};

export default Settings;

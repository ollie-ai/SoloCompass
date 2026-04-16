import { motion } from 'framer-motion';
import { CreditCard, Zap, Check, X, ArrowUpRight, Download, Trash2, AlertTriangle, RotateCcw } from 'lucide-react';
import BillingHistory from '../BillingHistory';
import TokenDashboard from '../TokenDashboard';

const EASE = [0.16, 1, 0.3, 1];
const cardClass = "glass-card p-6 rounded-3xl border border-base-300/50";

const BillingTab = ({
  subscriptionStatus,
  loadingSubscription,
  handleCancelSubscription,
  navigate,
  saving,
  exporting,
  handleExportData,
  handleDeleteAccount,
}) => {
  return (
    <motion.div
      key="billing"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ ease: EASE, duration: 0.25 }}
      className="space-y-6"
    >
      <div>
        <h2 className="text-xl font-black text-base-content">Billing & Data</h2>
        <p className="text-base-content/60 font-medium text-sm mt-1">Manage your subscription, download your data, or delete your account.</p>
      </div>

      <div className="flex flex-col gap-1 mb-6">
        <h2 className="text-xl font-black text-base-content flex items-center gap-2">
          <CreditCard size={20} className="text-brand-vibrant" /> Subscription & Data
        </h2>
        <p className="text-base-content/60 font-medium text-sm">Manage your plan, billing history, and personal data archive.</p>
      </div>

      <div className={cardClass}>
        <div className="p-6 border-b border-base-300/50 flex items-center justify-between">
          <h3 className="text-base font-black text-base-content flex items-center gap-2">
            Active Subscription
          </h3>
          <div className="px-2.5 py-0.5 rounded-full bg-base-200 text-[10px] font-black text-base-content/60 uppercase tracking-tighter">
            Billing status
          </div>
        </div>
        <div className="p-5">
          {subscriptionStatus?.isPremium ? (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-gradient-to-r from-brand-vibrant/5 to-emerald-500/5 border border-brand-vibrant/10">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h4 className="font-black text-base-content">
                      {subscriptionStatus.tier === 'guardian' ? 'Guardian' : subscriptionStatus.tier === 'navigator' ? 'Navigator' : 'Explorer'}
                    </h4>
                    <p className="text-xs text-base-content/60 font-medium">
                      {subscriptionStatus.stripeStatus?.cancelAtPeriodEnd
                        ? 'Cancels at end of billing period'
                        : 'Active subscription'}
                    </p>
                  </div>
                  <span className={`px-2.5 py-0.5 text-xs font-bold rounded-full ${subscriptionStatus.stripeStatus?.cancelAtPeriodEnd
                    ? 'bg-warning/20 text-warning'
                    : 'bg-brand-vibrant/10 text-brand-vibrant'
                    }`}>
                    {subscriptionStatus.stripeStatus?.cancelAtPeriodEnd ? 'Cancelling' : 'Active'}
                  </span>
                </div>

                {subscriptionStatus.expiresAt && (
                  <p className="text-sm text-base-content/80 font-medium">
                    {subscriptionStatus.stripeStatus?.cancelAtPeriodEnd
                      ? `Access until ${new Date(subscriptionStatus.expiresAt).toLocaleDateString()}`
                      : `Renews on ${new Date(subscriptionStatus.expiresAt).toLocaleDateString()}`
                    }
                  </p>
                )}

                <div className="mt-3 pt-3 border-t border-brand-vibrant/10">
                  <h5 className="font-bold text-base-content mb-2 text-sm">Included Features</h5>
                  <div className="grid grid-cols-2 gap-1.5">
                    {subscriptionStatus.tier === 'navigator' ? (
                      <>
                        <div className="flex items-center gap-2 text-xs text-base-content/80 font-medium"><Check size={13} className="text-brand-vibrant" /> Personal Concierge</div>
                        <div className="flex items-center gap-2 text-xs text-base-content/80 font-medium"><Check size={13} className="text-brand-vibrant" /> Advanced Safety Analytics</div>
                        <div className="flex items-center gap-2 text-xs text-base-content/80 font-medium"><Check size={13} className="text-brand-vibrant" /> Buddy Matching with KYC</div>
                        <div className="flex items-center gap-2 text-xs text-base-content/80 font-medium"><Check size={13} className="text-brand-vibrant" /> Bulk Itinerary Sync</div>
                        <div className="flex items-center gap-2 text-xs text-base-content/80 font-medium"><Check size={13} className="text-brand-vibrant" /> Unlimited AI Generation</div>
                        <div className="flex items-center gap-2 text-xs text-base-content/80 font-medium"><Check size={13} className="text-brand-vibrant" /> Real-time Safety Updates</div>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center gap-2 text-xs text-base-content/80 font-medium"><Check size={13} className="text-brand-vibrant" /> Unlimited AI Generation</div>
                        <div className="flex items-center gap-2 text-xs text-base-content/80 font-medium"><Check size={13} className="text-brand-vibrant" /> Real-time Safety Updates</div>
                        <div className="flex items-center gap-2 text-xs text-base-content/80 font-medium"><Check size={13} className="text-brand-vibrant" /> Solo Guide Chat</div>
                        <div className="flex items-center gap-2 text-xs text-base-content/80 font-medium"><Check size={13} className="text-brand-vibrant" /> PDF Export</div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                {subscriptionStatus?.stripePortalUrl && (
                  <a
                    href={subscriptionStatus.stripePortalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 rounded-xl font-bold text-sm border border-base-300 text-base-content/80 hover:bg-base-200 transition-all inline-flex items-center gap-1.5"
                  >
                    Manage subscription <ArrowUpRight size={14} />
                  </a>
                )}
                {!subscriptionStatus?.stripeStatus?.cancelAtPeriodEnd && (
                  <button
                    onClick={handleCancelSubscription}
                    disabled={loadingSubscription}
                    className="px-4 py-2 rounded-xl font-bold text-sm border border-base-300 text-error hover:bg-error/10 disabled:opacity-50 transition-all"
                  >
                    {loadingSubscription ? 'Cancelling...' : 'Cancel subscription'}
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-base-200 border border-base-300/50">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 bg-base-300 rounded-lg flex items-center justify-center text-base-content/40">
                    <Zap size={16} />
                  </div>
                  <div>
                    <h4 className="font-bold text-base-content leading-none">Explorer</h4>
                    <p className="text-[10px] text-base-content/60 font-bold uppercase tracking-tight mt-1">Free Nomad Plan</p>
                  </div>
                </div>
                <ul className="space-y-1.5 text-sm text-base-content/80">
                  <li className="flex items-center gap-2 font-medium"><Check size={13} className="text-emerald-500" /> Create trips (up to 2 active)</li>
                  <li className="flex items-center gap-2 font-medium"><Check size={13} className="text-emerald-500" /> 1 AI Itinerary per month</li>
                  <li className="flex items-center gap-2 font-medium"><Check size={13} className="text-emerald-500" /> Manual check-ins + SOS</li>
                  <li className="flex items-center gap-2 font-medium text-base-content/30 decoration-slate-200 line-through"><X size={13} /> Scheduled check-ins</li>
                </ul>
              </div>

              <div className="grid gap-2">
                <button
                  onClick={() => navigate('/?upgrade=guardian')}
                  className="p-5 rounded-xl bg-gradient-to-br from-[#10b981]/5 to-[#10b981]/10 border border-[#10b981]/20 hover:border-[#10b981]/40 transition-all text-left group relative overflow-hidden"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h5 className="font-black text-[#10b981] text-lg">Guardian</h5>
                      <p className="text-xs text-base-content/60 font-bold uppercase tracking-tight">£4.99/month — Most Popular</p>
                    </div>
                    <ArrowUpRight size={20} className="text-[#10b981]/50 group-hover:text-[#10b981] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
                  </div>
                  <p className="text-sm text-base-content/80 font-medium leading-tight">Unlimited AI itineraries, scheduled check-ins, Safe-Return Timer, and safe haven locator.</p>
                </button>

                <button
                  onClick={() => navigate('/?upgrade=navigator')}
                  className="p-5 rounded-xl bg-[#0ea5e9]/5 border border-[#0ea5e9]/20 hover:border-[#0ea5e9]/40 transition-all text-left group"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h5 className="font-black text-[#0ea5e9] text-lg">Navigator</h5>
                      <p className="text-xs text-base-content/60 font-bold uppercase tracking-tight">£9.99/month — Founding Price</p>
                    </div>
                    <ArrowUpRight size={20} className="text-[#0ea5e9]/50 group-hover:text-[#0ea5e9] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
                  </div>
                  <p className="text-sm text-base-content/80 font-medium leading-tight">Everything in Guardian + AI destination chat, AI safety advice, and priority support.</p>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <BillingHistory />

      <TokenDashboard onUpgrade={() => navigate('/?upgrade=guardian')} />

      <div className={cardClass}>
        <div className="p-5 border-b border-base-300/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600">
              <Download size={16} />
            </div>
            <div>
              <h3 className="text-base font-black text-base-content">Data Portability</h3>
              <p className="text-xs text-base-content/60 font-medium">Download a complete archive of your travel data, preferences, and account information.</p>
            </div>
          </div>
        </div>
        <div className="p-5">
          <p className="text-sm text-base-content/80 font-medium mb-4">
            Your export includes trip data, itinerary, safety settings, and profile information.
          </p>
          <button
            onClick={handleExportData}
            disabled={exporting}
            className="inline-flex items-center gap-2 bg-brand-vibrant text-white shadow-md shadow-brand-vibrant/25 hover:bg-green-600 disabled:opacity-50 rounded-xl font-bold px-5 py-2.5 text-sm transition-all"
          >
            <Download size={14} /> {exporting ? 'Generating archive...' : 'Download my data archive'}
          </button>
          <p className="text-xs text-base-content/40 font-medium mt-4">
            Your data is retained for the duration of your account. After deletion, all data is permanently removed within 30 days.
          </p>
        </div>
      </div>

      <div className="bg-error/5 p-6 rounded-2xl border-2 border-red-500/10">
        <h3 className="text-base font-black text-error mb-4 flex items-center gap-2">
          <Trash2 size={18} /> Account Termination
        </h3>

        <div className="p-4 rounded-xl bg-base-100 border border-red-500/15 mb-4">
          <div className="flex gap-3">
            <AlertTriangle className="text-error shrink-0 mt-0.5" size={18} />
            <div>
              <h4 className="font-black text-red-900 mb-1">Permanently Delete Account</h4>
              <p className="text-sm text-error leading-relaxed font-medium">
                Once you delete your account, there is no going back. All itineraries, safety data, and account information will be wiped immediately.
              </p>
              <p className="text-xs text-error/80 font-medium mt-2">
                We recommend downloading your data archive before deleting.
              </p>
            </div>
          </div>
        </div>

        <p className="text-xs text-base-content/60 font-medium mb-3">
          Deleting your account permanently removes your trips, preferences, and associated account data.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-4 mt-6">
          <button
            onClick={handleDeleteAccount}
            disabled={saving}
            className="w-full sm:w-auto px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-black rounded-xl shadow-lg shadow-red-200 transition-all flex items-center justify-center gap-2 disabled:opacity-50 text-[10px] uppercase tracking-widest"
          >
            {saving ? <RotateCcw size={14} className="animate-spin" /> : <Trash2 size={14} />}
            {saving ? 'Processing...' : 'Delete My Account'}
          </button>
          <p className="text-[10px] text-base-content/40 font-bold italic">
            Wait! Have you downloaded your data archive yet?
          </p>
        </div>
      </div>
    </motion.div>
  );
};

export default BillingTab;

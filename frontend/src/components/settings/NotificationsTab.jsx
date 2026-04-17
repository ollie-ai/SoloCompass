import { motion } from 'framer-motion';
import { Bell, ShieldAlert, AlertTriangle, Clock, MapPin, Wallet, Users, MessageSquare, Mail, Phone, RotateCcw, Save, Check } from 'lucide-react';

const EASE = [0.16, 1, 0.3, 1];
const cardClass = "glass-card p-6 rounded-3xl border border-base-300/50";

const NotificationsTab = ({
  notifPrefs,
  setNotifPrefs,
  savingNotifPrefs,
  handleSaveNotifPrefs,
  handleResetNotifPrefs,
}) => {
  return (
    <motion.div
      key="notifications"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ ease: EASE, duration: 0.25 }}
      className="space-y-6"
    >
      <div>
        <h2 className="text-xl font-black text-base-content">Notifications</h2>
        <p className="text-base-content/60 font-medium text-sm mt-1">Choose how and when SoloCompass notifies you. Critical safety alerts are always enabled.</p>
      </div>

      <div className={cardClass}>
        <div className="p-6 border-b border-base-300/50">
          <h3 className="text-lg font-black text-base-content flex items-center gap-2">
            <Bell size={18} className="text-brand-vibrant" /> Notification Preferences
          </h3>
        </div>
        <div className="p-6">
          <div className="space-y-8">
            <div>
              <h4 className="text-sm font-black text-base-content/40 uppercase tracking-widest mb-4 flex items-center gap-2">
                <ShieldAlert size={14} /> Critical Alerts
              </h4>
              <p className="text-xs text-base-content/60 font-medium mb-3 -mt-2">These keep you safe and cannot be fully disabled.</p>
              <div className="space-y-3">
                {[
                  { key: 'checkinReminders', label: 'Check-In Reminders', desc: 'Reminded before a scheduled check-in is due', icon: Clock, locked: false },
                  { key: 'checkinMissed', label: 'Missed Check-In Warnings', desc: 'Alert sent when you miss a scheduled check-in', icon: AlertTriangle, locked: false },
                  { key: 'checkinEmergency', label: 'Emergency SOS Alerts', desc: 'Critical alerts when SOS is triggered', icon: ShieldAlert, locked: true },
                ].map((item) => {
                  const Icon = item.icon;
                  const isLocked = item.locked;
                  return (
                    <div key={item.key} className={`flex items-center justify-between p-4 rounded-xl ${isLocked ? 'bg-warning/5 border border-warning/20' : 'bg-base-200'}`}>
                      <div className="flex items-start gap-3">
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${isLocked ? 'bg-warning/10' : 'bg-error/10'}`}>
                          <Icon size={16} className={isLocked ? 'text-warning' : 'text-error'} />
                        </div>
                        <div>
                          <p className="font-bold text-base-content flex items-center gap-2">
                            {item.label}
                            {isLocked && (
                              <span className="text-[10px] font-black bg-warning/10 text-warning px-1.5 py-0.5 rounded uppercase tracking-tighter">Always On</span>
                            )}
                          </p>
                          <p className="text-xs text-base-content/60 font-medium">{item.desc}</p>
                        </div>
                      </div>
                      {isLocked ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-warning font-bold">Enabled</span>
                          <div className="w-11 h-6 bg-warning/20 rounded-full flex items-center justify-center">
                            <Check size={14} className="text-warning" />
                          </div>
                        </div>
                      ) : (
                        <label className="relative inline-flex items-center cursor-pointer shrink-0">
                          <input
                            type="checkbox"
                            checked={notifPrefs[item.key]}
                            onChange={(e) => setNotifPrefs({ ...notifPrefs, [item.key]: e.target.checked })}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-base-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-base-100 after:border-base-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-vibrant"></div>
                        </label>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <h4 className="text-sm font-black text-base-content/40 uppercase tracking-widest mb-4 flex items-center gap-2">
                <MapPin size={14} /> Trip Notifications
              </h4>
              <div className="space-y-3">
                {[
                  { key: 'tripReminders', label: 'Trip Reminders', desc: 'Notifications about upcoming trips and itinerary changes', icon: MapPin },
                  { key: 'budgetAlerts', label: 'Budget Alerts', desc: 'When you approach or exceed your budget limits', icon: Wallet },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.key} className="flex items-center justify-between p-4 bg-base-200 rounded-xl">
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-lg bg-brand-vibrant/10 flex items-center justify-center shrink-0 mt-0.5">
                          <Icon size={16} className="text-brand-vibrant" />
                        </div>
                        <div>
                          <p className="font-bold text-base-content">{item.label}</p>
                          <p className="text-xs text-base-content/60 font-medium">{item.desc}</p>
                        </div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer shrink-0">
                        <input
                          type="checkbox"
                          checked={notifPrefs[item.key]}
                          onChange={(e) => setNotifPrefs({ ...notifPrefs, [item.key]: e.target.checked })}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-base-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-base-100 after:border-base-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-vibrant"></div>
                      </label>
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <h4 className="text-sm font-black text-base-content/40 uppercase tracking-widest mb-4 flex items-center gap-2">
                <Users size={14} /> Community Notifications
              </h4>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-4 bg-base-200 rounded-xl">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg bg-brand-vibrant/10 flex items-center justify-center shrink-0 mt-0.5">
                      <Users size={16} className="text-brand-vibrant" />
                    </div>
                    <div>
                      <p className="font-bold text-base-content">Buddy Requests</p>
                      <p className="text-xs text-base-content/60 font-medium">When someone wants to connect as a travel buddy</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      checked={notifPrefs.buddyRequests}
                      onChange={(e) => setNotifPrefs({ ...notifPrefs, buddyRequests: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-base-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-base-100 after:border-base-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-vibrant"></div>
                  </label>
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-black text-base-content/40 uppercase tracking-widest mb-4 flex items-center gap-2">
                <MessageSquare size={14} /> Notification Channels
              </h4>
              <div className="space-y-3">
                {[
                  { key: 'emailNotifications', label: 'Email Notifications', desc: 'Receive notifications via email', icon: Mail },
                  { key: 'pushNotifications', label: 'Browser Push Notifications', desc: 'Get push notifications in your browser', icon: Bell },
                  { key: 'smsNotifications', label: 'SMS Notifications', desc: 'Critical alerts only: missed check-ins and emergencies', icon: Phone, badge: 'Urgent Only' },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.key} className={`flex items-center justify-between p-4 rounded-xl ${item.badge ? 'bg-warning/5 border border-warning/20' : 'bg-base-200'}`}>
                      <div className="flex items-start gap-3">
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${item.badge ? 'bg-warning/10' : 'bg-base-200'}`}>
                          <Icon size={16} className={item.badge ? 'text-warning' : 'text-base-content/60'} />
                        </div>
                        <div>
                          <p className="font-bold text-base-content flex items-center gap-2">
                            {item.label}
                            {item.badge && (
                              <span className="text-[10px] font-black bg-warning/10 text-warning px-1.5 py-0.5 rounded uppercase tracking-tighter">{item.badge}</span>
                            )}
                          </p>
                          <p className="text-xs text-base-content/60 font-medium">{item.desc}</p>
                        </div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer shrink-0">
                        <input
                          type="checkbox"
                          checked={notifPrefs[item.key]}
                          onChange={(e) => setNotifPrefs({ ...notifPrefs, [item.key]: e.target.checked })}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-base-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-base-100 after:border-base-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-vibrant"></div>
                      </label>
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <h4 className="text-sm font-black text-base-content/40 uppercase tracking-widest mb-4 flex items-center gap-2">
                <Clock size={14} /> Reminder Timing
              </h4>
              <div className="p-4 bg-base-200 rounded-xl border border-base-300/50">
                <label className="block text-sm font-bold text-base-content/70 mb-2">
                  Check-in reminder before due time
                </label>
                <select
                  value={notifPrefs.reminderMinutesBefore}
                  onChange={(e) => setNotifPrefs({ ...notifPrefs, reminderMinutesBefore: parseInt(e.target.value) })}
                  className="w-full px-4 py-3 rounded-xl border border-base-300 bg-base-100 font-bold text-base-content focus:outline-none focus:ring-2 focus:ring-brand-vibrant/20 focus:border-brand-vibrant"
                >
                  <option value={5}>5 minutes before</option>
                  <option value={10}>10 minutes before</option>
                  <option value={15}>15 minutes before</option>
                  <option value={30}>30 minutes before</option>
                  <option value={60}>1 hour before</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={handleResetNotifPrefs}
                className="inline-flex items-center gap-2 text-sm text-base-content/60 hover:text-base-content/80 font-bold transition-colors"
              >
                <RotateCcw size={14} /> Reset to defaults
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-2 bg-brand-vibrant text-white shadow-md shadow-brand-vibrant/25 hover:bg-green-600 disabled:opacity-50 rounded-xl font-bold px-6 py-2.5 transition-all"
                onClick={handleSaveNotifPrefs}
                disabled={savingNotifPrefs}
              >
                <Save size={16} />
                {savingNotifPrefs ? 'Saving...' : 'Save Preferences'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default NotificationsTab;

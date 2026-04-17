import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Calendar,
  Compass,
  Shield,
  Users,
  MessageCircle,
  ShieldAlert,
  Settings,
  HelpCircle,
  ChevronRight,
  LogOut,
} from 'lucide-react';
import { useAuthStore } from '../stores/authStore';

const NAV_SECTIONS = [
  {
    label: null,
    items: [
      { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
      { name: 'My Trips', path: '/trips', icon: Calendar },
      { name: 'Explore', path: '/destinations', icon: Compass },
      { name: 'Safety', path: '/safety', icon: Shield },
      { name: 'Buddies', path: '/buddies', icon: Users },
      { name: 'Messages', path: '/messages', icon: MessageCircle },
      { name: 'Alerts', path: '/advisories', icon: ShieldAlert },
    ],
  },
  {
    label: 'Account',
    items: [
      { name: 'Settings', path: '/settings', icon: Settings },
      { name: 'Help', path: '/help', icon: HelpCircle },
    ],
  },
];

/**
 * Sidebar — global desktop app navigation sidebar.
 * Renders only the navigation links; placement/positioning is left to the parent.
 *
 * Props:
 *  className  — extra classes for the <aside> wrapper
 *  onLogout   — () => void  (optional; if omitted the sidebar renders a logout button that calls authStore.logout)
 */
export default function Sidebar({ className = '', onLogout }) {
  const location = useLocation();
  const { user, logout } = useAuthStore();

  const isActive = (path) =>
    location.pathname === path ||
    (path !== '/' && location.pathname.startsWith(path + '/'));

  const handleLogout = () => {
    if (onLogout) {
      onLogout();
    } else {
      logout();
    }
  };

  return (
    <aside
      className={`hidden lg:flex flex-col w-56 shrink-0 bg-base-100 border-r border-base-300 min-h-screen ${className}`}
      aria-label="Application navigation"
    >
      {/* User identity */}
      {user && (
        <div className="px-4 py-5 border-b border-base-300">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white text-xs font-black shrink-0">
              {(user.name || 'U')
                .split(' ')
                .map((n) => n[0])
                .join('')
                .toUpperCase()
                .substring(0, 2)}
            </div>
            <div className="min-w-0">
              <p className="font-bold text-sm text-base-content truncate">{user.name}</p>
              <p className="text-[11px] text-base-content/50 truncate">{user.email}</p>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 py-4 overflow-y-auto">
        {NAV_SECTIONS.map((section, si) => (
          <div key={si} className="mb-4">
            {section.label && (
              <p className="px-4 mb-1 text-[10px] font-black uppercase tracking-widest text-base-content/40">
                {section.label}
              </p>
            )}
            <ul className="space-y-0.5 px-2">
              {section.items.map(({ name, path, icon: Icon }) => {
                const active = isActive(path);
                return (
                  <li key={path}>
                    <Link
                      to={path}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-colors ${
                        active
                          ? 'bg-primary/10 text-primary'
                          : 'text-base-content/70 hover:bg-base-200 hover:text-base-content'
                      }`}
                      aria-current={active ? 'page' : undefined}
                    >
                      <Icon size={16} aria-hidden="true" />
                      <span className="flex-1">{name}</span>
                      {active && <ChevronRight size={14} className="text-primary/60" aria-hidden="true" />}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Logout */}
      <div className="px-3 pb-6 border-t border-base-300 pt-4">
        <button
          type="button"
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-bold text-error hover:bg-error/10 transition-colors"
        >
          <LogOut size={16} aria-hidden="true" />
          Log out
        </button>
      </div>
    </aside>
  );
}

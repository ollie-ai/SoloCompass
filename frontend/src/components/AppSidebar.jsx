import { memo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Map, Compass, Shield, Users, MessageCircle,
  ShieldAlert, BookOpen, Lightbulb, DollarSign, NotebookPen,
  Settings, HelpCircle, Sparkles, Plus, ChevronRight
} from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { trackEvent } from '../lib/telemetry';
import Avatar from './Avatar';

// ─── Navigation structure ─────────────────────────────────────────────────────
const NAV_SECTIONS = [
  {
    label: 'Main',
    items: [
      { name: 'Dashboard',    path: '/dashboard',    icon: LayoutDashboard },
      { name: 'My Trips',     path: '/trips',        icon: Map },
      { name: 'Explore',      path: '/destinations', icon: Compass },
    ],
  },
  {
    label: 'Tools',
    items: [
      { name: 'Safety',       path: '/safety',       icon: Shield },
      { name: 'Budget',       path: '/budget',       icon: DollarSign },
      { name: 'Journal',      path: '/journal',      icon: NotebookPen },
      { name: 'Buddies',      path: '/buddies',      icon: Users },
      { name: 'Messages',     path: '/messages',     icon: MessageCircle },
    ],
  },
  {
    label: 'Resources',
    items: [
      { name: 'Advisories',   path: '/advisories',   icon: ShieldAlert },
      { name: 'Guides',       path: '/guides',       icon: BookOpen },
      { name: 'Tips',         path: '/tips',         icon: Lightbulb },
      { name: 'Phrasebook',   path: '/phrasebook',   icon: Sparkles },
    ],
  },
  {
    label: 'Account',
    items: [
      { name: 'Settings',     path: '/settings',     icon: Settings },
      { name: 'Help',         path: '/help',         icon: HelpCircle },
    ],
  },
];

// ─── Single nav item ──────────────────────────────────────────────────────────
const SidebarItem = memo(({ item, isActive }) => {
  const Icon = item.icon;
  return (
    <Link
      to={item.path}
      onClick={() => trackEvent('sidebar_nav', { to: item.path })}
      aria-current={isActive ? 'page' : undefined}
      className={`
        flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-semibold
        transition-colors duration-150
        ${isActive
          ? 'bg-primary/10 text-primary'
          : 'text-base-content/60 hover:bg-base-200 hover:text-base-content'}
      `}
    >
      <Icon size={17} aria-hidden="true" className={isActive ? 'text-primary' : ''} />
      <span>{item.name}</span>
      {isActive && (
        <ChevronRight size={13} className="ml-auto text-primary/50" aria-hidden="true" />
      )}
    </Link>
  );
});

SidebarItem.displayName = 'SidebarItem';

// ─── AppSidebar ───────────────────────────────────────────────────────────────
/**
 * AppSidebar — persistent desktop sidebar (hidden on mobile; BottomNav handles mobile).
 *
 * Renders a fixed-position sidebar on screens ≥ lg (1024 px). The rest of the
 * app layout shifts right via the `pl-64` class added to the main content wrapper.
 */
const AppSidebar = () => {
  const location = useLocation();
  const { user, isAuthenticated } = useAuthStore();

  if (!isAuthenticated) return null;

  return (
    <aside
      className="hidden lg:flex flex-col fixed top-0 left-0 h-screen w-64 z-40
                 bg-base-100 border-r border-base-200
                 pt-20 pb-6 overflow-y-auto"
      aria-label="App navigation"
    >
      {/* User mini-profile */}
      {user && (
        <div className="px-4 pb-4 mb-2 border-b border-base-200">
          <Link
            to="/dashboard"
            className="flex items-center gap-3 rounded-xl p-2 hover:bg-base-200 transition-colors"
            aria-label="Go to dashboard"
          >
            <Avatar
              src={user.avatar_url}
              name={user.name}
              size="sm"
              status="online"
            />
            <div className="min-w-0">
              <p className="text-sm font-black text-base-content truncate">{user.name}</p>
              <p className="text-xs text-base-content/40 truncate">{user.email}</p>
            </div>
          </Link>
        </div>
      )}

      {/* Quick action */}
      <div className="px-4 pb-4">
        <Link
          to="/trips/new"
          onClick={() => trackEvent('sidebar_nav', { to: '/trips/new' })}
          className="flex items-center justify-center gap-2 w-full px-4 py-2.5
                     rounded-xl bg-primary text-primary-content text-sm font-bold
                     hover:bg-primary/90 shadow-brand transition-colors"
        >
          <Plus size={16} aria-hidden="true" />
          New Trip
        </Link>
      </div>

      {/* Nav sections */}
      <nav className="flex-1 px-3 space-y-5" aria-label="Primary navigation">
        {NAV_SECTIONS.map(section => (
          <div key={section.label}>
            <p className="px-3 mb-1 text-[10px] uppercase tracking-widest text-base-content/30 font-black">
              {section.label}
            </p>
            <ul className="space-y-0.5" role="list">
              {section.items.map(item => (
                <li key={item.path}>
                  <SidebarItem
                    item={item}
                    isActive={
                      item.path === '/dashboard'
                        ? location.pathname === '/dashboard'
                        : location.pathname.startsWith(item.path)
                    }
                  />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
};

export default AppSidebar;

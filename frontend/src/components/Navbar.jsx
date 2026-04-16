import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useState, useEffect, memo } from 'react';
import PropTypes from 'prop-types';
import { useAuthStore } from '../stores/authStore';
import UserDropdown from './UserDropdown';
import NotificationDropdown from './NotificationDropdown';
import LanguageSelector from './LanguageSelector';
import api from '../lib/api';
import { trackEvent } from '../lib/telemetry';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Menu, X, Compass, LayoutDashboard, Shield, ShieldAlert, 
  Calendar, Users, ChevronRight as CaretRight, MapPin, Plus,
  Sparkles, HelpCircle, ChevronDown, Home, ChevronRight, MessageCircle, Book
} from 'lucide-react';

const PUBLIC_LINKS = [
  { name: 'Home', path: '/', label: 'home', icon: Home },
  { name: 'Features', path: '/features', label: 'features', icon: Sparkles },
  { name: 'FAQ', path: '/faq', label: 'faq', icon: HelpCircle },
  { name: 'Blog', path: '/blog', label: 'blog', icon: Book },
  { name: 'Safety', path: '/safety-info', label: 'safety', icon: Shield },
  { name: 'Help', path: '/help', label: 'help', icon: HelpCircle },
];

const APP_LINKS = [
  { name: 'My Trips', path: '/trips', icon: Calendar },
  { name: 'Explore', path: '/destinations', icon: Compass },
  { name: 'Safety', path: '/safety', icon: Shield },
  { name: 'Buddies', path: '/buddies', icon: Users },
  { name: 'Messages', path: '/messages', icon: MessageCircle },
  { name: 'Alerts', path: '/advisories', icon: ShieldAlert },
];

const Logo = memo(({ scrolled }) => (
  <Link to="/" className="flex items-center gap-3 group" onClick={() => trackEvent('nav_click', { location: 'logo' })}>
    <motion.div 
      className="hidden sm:flex flex-col leading-tight"
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.2 }}
    >
      <div className="flex items-center gap-3">
        <svg width="44" height="44" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-base-content">
          <style>{`
            @keyframes idleFloat {
              0%, 100% { transform: rotate(-1deg); }
              50% { transform: rotate(1deg); }
            }
            @keyframes magneticEngage {
              0% { transform: rotate(0deg); }
              20% { transform: rotate(-45deg); }
              45% { transform: rotate(20deg); }
              65% { transform: rotate(-8deg); }
              80% { transform: rotate(3deg); }
              100% { transform: rotate(0deg); }
            }
            .animated-needle {
              transform-box: view-box;
              transform-origin: 40px 40px; 
              animation: idleFloat 4s ease-in-out infinite;
            }
            svg:hover .animated-needle {
              animation: magneticEngage 1.5s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
            }
          `}</style>
          <circle cx="40" cy="40" r="28" stroke="currentColor" strokeWidth="6" />
          <g className="animated-needle">
            <path d="M40 18 C42 18 45 32 45 35 C45 37.76 42.76 40 40 40 C37.24 40 35 37.76 35 35 C35 32 38 18 40 18Z" fill="#10B981" />
            <path d="M40 62 C38 62 35 48 35 45 C35 42.24 37.24 40 40 40 C42.76 40 45 42.24 45 45 C45 48 42 62 40 62Z" fill="currentColor" />
            <circle cx="40" cy="40" r="4" fill="#FFFFFF" />
          </g>
        </svg>
        <span className="text-2xl font-black tracking-tight">
          <span className="text-primary">SOLO</span>
          <span className="ml-1 text-base-content/60">COMPASS</span>
        </span>
      </div>
    </motion.div>
  </Link>
));

Logo.propTypes = {
  scrolled: PropTypes.bool,
};

const NavLink = memo(({ to, children, isActive, onClick, icon: Icon }) => (
  <Link to={to} onClick={onClick} className="relative">
    <motion.div
      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
        isActive 
          ? 'text-white' 
          : 'text-base-content/60 hover:text-base-content hover:bg-base-content/5'
      }`}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      {isActive && (
        <motion.div
          layoutId="activeTab"
          className="absolute inset-0 bg-primary rounded-lg"
          transition={{ type: "spring", stiffness: 500, damping: 35 }}
        />
      )}
      <span className="relative z-10 flex items-center gap-1.5">
        {Icon && <Icon size={15} />}
        {children}
      </span>
    </motion.div>
  </Link>
));

NavLink.propTypes = {
  to: PropTypes.string.isRequired,
  children: PropTypes.node.isRequired,
  isActive: PropTypes.bool,
  onClick: PropTypes.func,
  icon: PropTypes.elementType,
};

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { isAuthenticated, logout, user } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();
  const [activeTrip, setActiveTrip] = useState(null);
  const [hasNotifications, setHasNotifications] = useState(false);
  const [notificationCount, setNotificationCount] = useState(0);

  const isPublicPage = ['/', '/login', '/register', '/about', '/features', '/safety-info', '/help', '/terms', '/privacy', '/cookies', '/contact', '/partnerships'].includes(location.pathname);
  const isAppPage = isAuthenticated && !isPublicPage;

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      checkActiveTripAndNotifications();
      fetchNotificationCount();
    }
  }, [isAuthenticated, location.pathname]);

  const fetchNotificationCount = async () => {
    try {
      const res = await api.get('/notifications/unread-count');
      setNotificationCount(res.data.data?.count || 0);
    } catch (err) {
      console.error('Failed to fetch notification count:', err);
    }
  };

  const checkActiveTripAndNotifications = async () => {
    try {
      const [tripsRes, alertsRes] = await Promise.all([
        api.get('/trips'),
        api.get('/advisories')
      ]);
      const tripsData = tripsRes.data.data?.trips || [];
      const now = new Date();
      const live = tripsData.find(trip => {
        if (!trip.start_date || !trip.end_date) return false;
        const start = new Date(trip.start_date);
        const end = new Date(trip.end_date);
        return now >= start && now <= end;
      });
      setActiveTrip(live || null);
      
      const destinationAlerts = live ? alertsRes.data.data?.filter(a => a.country?.toLowerCase() === live.destination?.toLowerCase()) : [];
      setHasNotifications(destinationAlerts && destinationAlerts.length > 0);
    } catch (err) {
      console.error(err);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const handleNavClick = (label, path) => {
    trackEvent('nav_click', { location: label, path, authenticated: isAuthenticated });
    setIsOpen(false);
  };

  const isActive = (path) => location.pathname === path || location.pathname.startsWith(path + '/');

  return (
    <>
      <motion.nav
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        className={`fixed top-0 left-0 right-0 z-[60] transition-all duration-300 ${
          scrolled || !isPublicPage 
            ? 'bg-base-100 backdrop-blur-md border-b border-base-content/10 shadow-lg' 
            : 'bg-base-100/95 backdrop-blur-sm'
        }`}
      >
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20 py-4">
            <div className="flex-shrink-0">
              <Logo scrolled={scrolled} />
            </div>

            <div className="hidden lg:flex items-center justify-center flex-1 px-8">
              {isAuthenticated ? (
                isAppPage ? (
                  <div className="flex items-center gap-2 px-6 py-2.5 bg-base-200/70 rounded-xl">
                    <NavLink
                      to="/dashboard"
                      isActive={isActive('/dashboard')}
                      onClick={() => handleNavClick('dashboard', '/dashboard')}
                      icon={LayoutDashboard}
                    >
                      Dashboard
                    </NavLink>
                    {APP_LINKS.map((link) => {
                      const Icon = link.icon;
                      return (
                        <NavLink
                          key={link.path}
                          to={link.path}
                          isActive={isActive(link.path)}
                          onClick={() => handleNavClick(link.label || link.name.toLowerCase(), link.path)}
                          icon={Icon}
                        >
                          {link.name}
                        </NavLink>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 px-6 py-2.5 bg-base-200/70 rounded-xl">
                    {PUBLIC_LINKS.map((link) => {
                      const Icon = link.icon;
                      return (
                        <NavLink
                          key={link.path}
                          to={link.path}
                          isActive={isActive(link.path)}
                          onClick={() => handleNavClick(link.label, link.path)}
                          icon={Icon}
                        >
                          {link.name}
                        </NavLink>
                      );
                    })}
                  </div>
                )
              ) : (
                <div className="flex items-center gap-2 px-6 py-2.5 bg-base-200/70 rounded-2xl">
                  {PUBLIC_LINKS.map((link) => {
                    const Icon = link.icon;
                    return (
                      <NavLink
                        key={link.path}
                        to={link.path}
                        isActive={isActive(link.path)}
                        onClick={() => handleNavClick(link.label, link.path)}
                        icon={Icon}
                      >
                        {link.name}
                      </NavLink>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex items-center gap-6">
              <LanguageSelector />
              {isAuthenticated && isAppPage && (
                <NotificationDropdown
                  unreadCount={notificationCount}
                  onCountChange={setNotificationCount}
                />
              )}
              {isAuthenticated ? (
                <UserDropdown 
                  user={user} 
                  onLogout={handleLogout} 
                  hasNotifications={hasNotifications}
                  activeTrip={activeTrip}
                />
              ) : (
                <>
                  <Link 
                    to="/login" 
                    onClick={() => handleNavClick('sign_in', '/login')}
                    className="text-base font-bold text-base-content/60 hover:text-primary px-4 py-2 transition-colors"
                  >
                    Sign In
                  </Link>
                  <Link 
                    to="/register" 
                    onClick={() => handleNavClick('get_started', '/register')}
                    className="text-base font-bold px-5 py-2.5 bg-primary text-white rounded-xl hover:bg-primary/90 transition-colors shadow-lg shadow-primary/30"
                  >
                    Get Started Free
                  </Link>
                </>
              )}
               
              <button
                onClick={() => setIsOpen(!isOpen)}
                className="lg:hidden p-2.5 text-base-content/70 hover:bg-base-200 rounded-xl transition-colors"
                aria-label={isOpen ? 'Close menu' : 'Open menu'}
              >
                <motion.div
                  animate={{ rotate: isOpen ? 90 : 0 }}
                  transition={{ duration: 0.2 }}
                >
                  {isOpen ? <X size={24} /> : <Menu size={24} />}
                </motion.div>
              </button>
            </div>
          </div>
        </div>
      </motion.nav>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="lg:hidden fixed top-[72px] left-0 right-0 z-50 bg-base-100 border-b border-base-content/10 shadow-xl max-h-[85vh] overflow-y-auto"
          >
            <div className="px-4 py-4 space-y-2">
              {isAuthenticated ? (
                <>
                  {isAppPage && (
                    <div className="flex items-center justify-between px-2 py-3 border-b border-base-content/5">
                      <span className="text-sm font-bold text-base-content/60">Notifications</span>
                      <NotificationDropdown
                        unreadCount={notificationCount}
                        onCountChange={setNotificationCount}
                      />
                    </div>
                  )}
                  <div className="pb-4 mb-2 border-b border-base-content/5">
                    <div className="flex items-center gap-3 px-2">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-black">
                        {user?.name?.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2) || 'U'}
                      </div>
                      <div>
                        <p className="font-bold text-base-content">{user?.name}</p>
                        <p className="text-xs text-base-content/60">{user?.email}</p>
                      </div>
                    </div>
                  </div>
                  
                  {(isAppPage ? APP_LINKS : PUBLIC_LINKS).map((link) => {
                    const Icon = link.icon;
                    return (
                      <Link
                        key={link.path}
                        to={link.path}
                        onClick={() => { handleNavClick(link.label || link.name.toLowerCase(), link.path); setIsOpen(false); }}
                        className={`flex items-center gap-3 px-4 py-3.5 rounded-xl text-base font-bold transition-colors ${
                          isActive(link.path) 
                            ? 'bg-primary/10 text-primary' 
                            : 'text-base-content/70 hover:bg-base-200'
                        }`}
                      >
                        {Icon && <Icon size={20} />}
                        {link.name}
                        <CaretRight size={18} className="ml-auto opacity-40" />
                      </Link>
                    );
                  })}
                  
                  {isAuthenticated && !isAppPage && (
                    <Link 
                      to="/dashboard" 
                      onClick={() => { handleNavClick('dashboard_mobile', '/dashboard'); setIsOpen(false); }}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl text-base font-bold text-primary hover:bg-primary/5"
                    >
                      <LayoutDashboard size={20} />
                      My Dashboard
                      <ChevronRight size={18} className="ml-auto text-base-content/30" />
                    </Link>
                  )}
                  
                  <div className="pt-4 mt-2 border-t border-base-content/5 space-y-1">
                    <Link
                      to="/settings"
                      onClick={() => { handleNavClick('settings_mobile', '/settings'); setIsOpen(false); }}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl text-base font-bold text-base-content/70 hover:bg-base-200"
                    >
                      Settings
                    </Link>
                    <Link
                      to="/help"
                      onClick={() => { handleNavClick('help_mobile', '/help'); setIsOpen(false); }}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl text-base font-bold text-base-content/70 hover:bg-base-200"
                    >
                      Help & Support
                      <CaretRight size={18} className="ml-auto opacity-40" />
                    </Link>
                    <button
                      onClick={() => { handleLogout(); setIsOpen(false); }}
                      className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-base font-semibold text-error hover:bg-error/10 transition-colors"
                    >
                      Logout
                    </button>
                  </div>
                </>
              ) : (
                <div className="space-y-2 pt-2">
                  {PUBLIC_LINKS.map((link) => {
                    const Icon = link.icon;
                    return (
                      <Link
                        key={link.path}
                        to={link.path}
                        onClick={() => { handleNavClick(link.label, link.path); setIsOpen(false); }}
                        className="flex items-center gap-3 px-4 py-3 rounded-xl text-base font-semibold text-base-content/80 hover:bg-base-200"
                      >
                        {Icon && <Icon size={20} />}
                        {link.name}
                        <CaretRight size={18} className="ml-auto text-base-content/30" />
                      </Link>
                    );
                  })}
                  <div className="grid grid-cols-2 gap-3 pt-4 border-t border-base-300/50">
                    <Link to="/login" onClick={() => setIsOpen(false)} className="btn btn-outline btn-sm rounded-xl border-base-content/20">Sign In</Link>
                    <Link to="/register" onClick={() => setIsOpen(false)} className="text-base font-bold px-5 py-2.5 bg-primary text-white rounded-xl hover:bg-primary/90 transition-colors">Get Started Free</Link>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default Navbar;

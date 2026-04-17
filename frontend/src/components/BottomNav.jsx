import { Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { trackEvent } from '../lib/telemetry';
import { motion, AnimatePresence } from 'framer-motion';
import { Home, Compass, Plus, Shield, User, Map } from 'lucide-react';
import { useState, useEffect, memo } from 'react';
import PropTypes from 'prop-types';

const BOTTOM_NAV_ITEMS = [
  { name: 'Home', path: '/', icon: Home, authRequired: false },
  { name: 'Explore', path: '/destinations', icon: Compass, authRequired: true },
  { name: 'New Trip', path: '/trips/new', icon: Plus, authRequired: true, primary: true },
  { name: 'Trips', path: '/trips', icon: Map, authRequired: true },
  { name: 'Safety', path: '/safety', icon: Shield, authRequired: true },
  { name: 'Profile', path: '/dashboard', icon: User, authRequired: true, profile: true },
];

const BottomNavItem = memo(({ item, isActive, isAuthenticated, user, onNavClick }) => {
  const Icon = item.icon;
  
  if (item.primary) {
    return (
      <motion.div
        key={item.path}
        className="relative -mt-3"
      >
        <Link
          to={item.path}
          onClick={() => onNavClick(item.name.toLowerCase())}
          className="flex flex-col items-center justify-center"
          aria-label="Create new trip"
        >
          <motion.div
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary via-emerald-500 to-secondary flex items-center justify-center shadow-xl shadow-primary/40 border-4 border-white"
          >
            <Icon size={26} className="text-white" />
          </motion.div>
        </Link>
      </motion.div>
    );
  }

  if (item.profile) {
    const getInitials = (name) => {
      if (!name) return 'U';
      return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
    };

    return (
      <Link
        key={item.path}
        to={item.path}
        onClick={() => onNavClick('profile')}
        className={`flex flex-col items-center justify-center py-3 px-3 rounded-xl transition-all`}
      >
        <motion.div 
          className={`w-10 h-10 rounded-full flex items-center justify-center ${
            isAuthenticated && user
              ? 'bg-gradient-to-br from-primary to-secondary' 
              : 'bg-base-300'
          }`}
        >
          {isAuthenticated && user ? (
            <span className="text-xs font-black text-white">{getInitials(user.name)}</span>
          ) : (
            <Icon size={18} className="text-white" />
          )}
        </motion.div>
        <span className="text-[10px] font-bold mt-1.5 text-base-content/60">Profile</span>
      </Link>
    );
  }

  return (
    <Link
      key={item.path}
      to={item.path}
      onClick={() => onNavClick(item.name.toLowerCase())}
      className={`flex flex-col items-center justify-center py-2 px-4 rounded-xl transition-all relative`}
    >
      {isActive && (
        <motion.div
          layoutId="bottomNavActive"
          className="absolute inset-0 bg-primary/10 rounded-xl"
          transition={{ type: "spring", stiffness: 500, damping: 35 }}
        />
      )}
      <Icon size={22} className={isActive ? 'text-primary' : 'text-base-content/60'} />
      <span className={`text-[10px] font-bold mt-1 ${isActive ? 'text-primary' : 'text-base-content/60'}`}>
        {item.name}
      </span>
    </Link>
  );
});

BottomNavItem.propTypes = {
  item: PropTypes.shape({
    name: PropTypes.string.isRequired,
    path: PropTypes.string.isRequired,
    icon: PropTypes.elementType.isRequired,
    authRequired: PropTypes.bool,
    primary: PropTypes.bool,
    profile: PropTypes.bool,
  }).isRequired,
  isActive: PropTypes.bool,
  isAuthenticated: PropTypes.bool,
  user: PropTypes.object,
  onNavClick: PropTypes.func.isRequired,
};

const BottomNav = () => {
  const location = useLocation();
  const { isAuthenticated, user } = useAuthStore();
  const [isVisible, setIsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      if (currentScrollY > lastScrollY && currentScrollY > 100) {
        setIsVisible(false);
      } else {
        setIsVisible(true);
      }
      setLastScrollY(currentScrollY);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [lastScrollY]);

  const isPublicPage = ['/', '/login', '/register', '/about', '/features', '/safety-info', '/help', '/terms', '/privacy'].includes(location.pathname);

  const handleNavClick = (label) => {
    trackEvent('bottom_nav_click', { tab: label });
  };

  const filteredItems = BOTTOM_NAV_ITEMS.filter(item => {
    if (!item.authRequired) return true;
    return isAuthenticated;
  });

  const getInitials = (name) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
  };

  if (!isAuthenticated && isPublicPage) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.nav
        initial={{ y: 100 }}
        animate={{ y: isVisible ? 0 : 100 }}
        exit={{ y: 100 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        role="navigation"
        aria-label="Bottom navigation"
        className="fixed bottom-0 left-0 right-0 z-50 lg:hidden pb-[env(safe-area-inset-bottom,0px)]"
      >
        <div className="bg-base-100/95 backdrop-blur-xl border-t border-base-300/80 shadow-[0_-8px_30px_rgba(0,0,0,0.1)]">
          <div className="flex items-center justify-around h-16 px-1">
            {filteredItems.map((item) => {
              const isActive = location.pathname === item.path || 
                (item.path !== '/' && location.pathname.startsWith(item.path));
              
              return (
                <BottomNavItem
                  key={item.path}
                  item={item}
                  isActive={isActive}
                  isAuthenticated={isAuthenticated}
                  user={user}
                  onNavClick={handleNavClick}
                />
              );
            })}
          </div>
        </div>
      </motion.nav>
    </AnimatePresence>
  );
};

export default BottomNav;

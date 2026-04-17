import { Outlet, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Navbar from './Navbar';
import Footer from './Footer';
import AIChat from './AIChat';
import AnnouncementBanner from './AnnouncementBanner';
import GlobalSearch from './GlobalSearch';
import AppSidebar from './AppSidebar';
import { useAuthStore } from '../stores/authStore';
import { useEffect, useState } from 'react';
import { usePullToRefresh } from '../hooks/usePullToRefresh';
import FeatureTour from './tour/FeatureTour';

// Pages that should NOT show the sidebar (public / auth pages)
const NO_SIDEBAR_PATHS = [
  '/', '/login', '/register', '/about', '/features', '/safety-info',
  '/help', '/terms', '/privacy', '/cookies', '/contact', '/partnerships',
  '/pricing', '/forgot-password', '/reset-password',
];

const Layout = () => {
  const location = useLocation();
  const [isLoaded, setIsLoaded] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoaded(true), 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const main = document.getElementById('main-content');
    if (main && isLoaded) {
      main.classList.add('visible');
    }
  }, [location.pathname, isLoaded]);

  const { isAuthenticated } = useAuthStore();
  const { isRefreshing } = usePullToRefresh(() => window.location.reload(), isAuthenticated);
  const isPublicPage = ['/', '/login', '/register', '/about', '/features', '/safety-info', '/help', '/terms', '/privacy', '/cookies', '/contact', '/partnerships'].includes(location.pathname);

  return (
    <div className="min-h-screen flex flex-col bg-base-100 text-base-content transition-colors duration-300">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[999] focus:px-4 focus:py-2 focus:bg-brand-vibrant focus:text-white focus:rounded-lg focus:font-bold">
        Skip to main content
      </a>
      <Navbar />
      {isAuthenticated && <AnnouncementBanner />}
      <main id="main-content" role="main" className="flex-1 pt-20" tabIndex={-1}>
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="min-h-full"
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>
      {isRefreshing && (<div className="fixed top-16 left-1/2 -translate-x-1/2 z-[1100] rounded-full bg-base-100 border border-base-300 px-3 py-1 text-xs">Refreshing...</div>)}
      <FeatureTour />
      <AIChat />
      {isPublicPage && <Footer />}
    </div>
  );
};

export default Layout;

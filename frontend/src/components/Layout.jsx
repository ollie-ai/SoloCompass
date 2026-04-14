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
  const isPublicPage = NO_SIDEBAR_PATHS.includes(location.pathname);
  const showSidebar  = isAuthenticated && !isPublicPage;

  return (
    <div className="min-h-screen flex flex-col bg-base-100 text-base-content transition-colors duration-300">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[999] focus:px-4 focus:py-2 focus:bg-brand-vibrant focus:text-white focus:rounded-lg focus:font-bold">
        Skip to main content
      </a>
      <Navbar />
      {isAuthenticated && <AnnouncementBanner />}
      <GlobalSearch isOpen={searchOpen} onClose={() => setSearchOpen(false)} />

      {/* Sidebar + content wrapper */}
      <div className="flex flex-1">
        {showSidebar && <AppSidebar />}

        <main
          id="main-content"
          className={`flex-1 pt-20 min-h-full ${showSidebar ? 'lg:pl-64' : ''}`}
          tabIndex={-1}
        >
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
      </div>

      <AIChat />
      {isPublicPage && <Footer />}
    </div>
  );
};

export default Layout;

import { Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { motion } from 'framer-motion';
import { Compass, MapPin, Shield, Twitter, Instagram, Github } from 'lucide-react';

const FooterLogo = () => (
  <Link to="/" className="flex items-center gap-4 group">
    <svg width="64" height="64" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-brand-vibrant">
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
        .animated-needle-footer {
          transform-box: view-box;
          transform-origin: 40px 40px; 
          animation: idleFloat 4s ease-in-out infinite;
        }
        a:hover .animated-needle-footer {
          animation: magneticEngage 1.5s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
        }
      `}</style>
      <circle cx="40" cy="40" r="28" stroke="#FFFFFF" strokeWidth="6" fill="none" />
      <g className="animated-needle-footer">
        <path d="M40 18 C42 18 45 32 45 35 C45 37.76 42.76 40 40 40 C37.24 40 35 37.76 35 35 C35 32 38 18 40 18Z" fill="#10B981" />
        <path d="M40 62 C38 62 35 48 35 45 C35 42.24 37.24 40 40 40 C42.76 40 45 42.24 45 45 C45 48 42 62 40 62Z" fill="currentColor" />
        <circle cx="40" cy="40" r="4" fill="#FFFFFF" />
      </g>
    </svg>
    <div className="flex flex-col leading-tight">
      <span className="text-4xl font-black tracking-tight">
        <span className="text-white">SOLO</span>
        <span className="ml-2 text-[#667085] font-medium">COMPASS</span>
      </span>
    </div>
  </Link>
);

const Footer = () => {
  const { isAuthenticated } = useAuthStore();
  const location = useLocation();

  const isPublicPage = ['/', '/login', '/register', '/about', '/features', '/safety-info', '/help', '/terms', '/privacy', '/cookies', '/contact', '/partnerships'].includes(location.pathname);
  const isAppPage = isAuthenticated && !isPublicPage;

  if (['/login', '/register'].includes(location.pathname)) return null;

  const socialLinks = [
    { name: 'Twitter', href: 'https://twitter.com/solocompass', icon: Twitter, color: 'hover:text-[#1DA1F2]' },
    { name: 'Instagram', href: 'https://instagram.com/solocompass', icon: Instagram, color: 'hover:text-[#E4405F]' },
    { name: 'GitHub', href: 'https://github.com/solocompass', icon: Github, color: 'hover:text-white' },
  ];

  const footerLinks = {
    product: [
      { name: 'Features', path: '/features' },
      { name: 'Safety', path: '/safety-info' },
      { name: 'Pricing', path: '/pricing' },
    ],
    company: [
      { name: 'About', path: '/about' },
      { name: 'Contact', path: '/contact' },
      { name: 'FAQ', path: '/faq' },
      { name: 'Changelog', path: '/changelog' },
      { name: 'Partnerships', path: '/partnerships' },
    ],
    legal: [
      { name: 'Terms', path: '/terms' },
      { name: 'Privacy', path: '/privacy' },
      { name: 'Cookies', path: '/cookies' },
    ],
  };

  return (
    <footer className="mt-auto relative bg-[#0f172a] overflow-hidden border-t-4 border-brand-accent">
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#10b981 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-brand-vibrant/5 rounded-full blur-[100px] pointer-events-none"></div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 mb-10">
          {/* Brand Section */}
          <div className="lg:col-span-2">
            <FooterLogo />
            <p className="mt-4 text-white/40 text-sm leading-relaxed max-w-xs">
              Your trusted companion for safe solo travel. Plan confidently, explore boldly, and stay connected wherever your journey takes you.
            </p>
            
            {/* Social Links - Bigger & Brighter */}
            <div className="flex gap-4 mt-6">
              {socialLinks.map((social) => (
                <a
                  key={social.name}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`w-11 h-11 rounded-xl bg-white/10 border border-white/10 flex items-center justify-center text-white/40 ${social.color} transition-all hover:bg-white/20 hover:scale-110 hover:border-white/30`}
                  aria-label={`Follow SoloCompass on ${social.name}`}
                >
                  <social.icon size={20} />
                </a>
              ))}
            </div>
          </div>

          {/* Product Links */}
          <div>
            <h4 className="text-sm font-black text-white uppercase tracking-widest mb-4">Product</h4>
            <ul className="space-y-3">
              {footerLinks.product.map((link) => (
                <li key={link.path}>
                  <Link to={link.path} className="text-white/50 hover:text-brand-vibrant transition-colors text-sm font-medium">
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company Links */}
          <div>
            <h4 className="text-sm font-black text-white uppercase tracking-widest mb-4">Company</h4>
            <ul className="space-y-3">
              {footerLinks.company.map((link) => (
                <li key={link.path}>
                  <Link to={link.path} className="text-white/50 hover:text-brand-vibrant transition-colors text-sm font-medium">
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal Links */}
          <div>
            <h4 className="text-sm font-black text-white uppercase tracking-widest mb-4">Legal</h4>
            <ul className="space-y-3">
              {footerLinks.legal.map((link) => (
                <li key={link.path}>
                  <Link to={link.path} className="text-white/50 hover:text-brand-vibrant transition-colors text-sm font-medium">
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-white/10">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/40 hover:text-brand-vibrant transition-all text-xs font-medium"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 19V5M5 12l7-7 7 7"/>
                </svg>
                Back to Top
              </button>
              <p className="text-white/40 text-sm font-medium">
                &copy; {new Date().getFullYear()} SoloCompass. All rights reserved.
              </p>
            </div>
            <a 
              href="https://nd3.dev" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-white/40 text-sm font-medium hover:text-brand-vibrant transition-colors"
            >
              Built with ❤️ for solo travellers everywhere by <span className="text-brand-vibrant font-bold">ND3 Labs</span>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;

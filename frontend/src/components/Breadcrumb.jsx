import { Link, useLocation } from 'react-router-dom';
import { Home, ChevronRight } from 'lucide-react';

const LABEL_MAP = {
  dashboard: 'Dashboard',
  trips: 'Trips',
  new: 'New',
  settings: 'Settings',
  admin: 'Admin',
  destinations: 'Destinations',
  safety: 'Safety',
  help: 'Help',
  faq: 'FAQ',
  about: 'About',
  contact: 'Contact',
  pricing: 'Pricing',
  features: 'Features',
  changelog: 'Changelog',
  advisories: 'Advisories',
  reviews: 'Reviews',
  buddies: 'Buddies',
  quiz: 'Quiz',
  countries: 'Countries',
  cities: 'Cities',
};

const humanize = (segment) => {
  if (LABEL_MAP[segment]) return LABEL_MAP[segment];
  // Convert kebab-case / slug to Title Case
  return segment
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
};

/**
 * Breadcrumb — auto-generates breadcrumb navigation from the current URL path.
 *
 * Props:
 *   className   – extra class names for the outer nav element
 *   homeLabel   – label for the home link (default: 'Home')
 *   maxSegments – max path segments to show (default: 4)
 */
export default function Breadcrumb({ className = '', homeLabel = 'Home', maxSegments = 4 }) {
  const { pathname } = useLocation();
  const segments = pathname.split('/').filter(Boolean);

  // Nothing to show on home or single-segment public pages
  if (segments.length === 0) return null;

  const crumbs = segments.slice(0, maxSegments).map((seg, idx) => {
    const href = '/' + segments.slice(0, idx + 1).join('/');
    const isLast = idx === segments.length - 1 || idx === maxSegments - 1;
    return { label: humanize(seg), href, isLast };
  });

  return (
    <nav
      aria-label="Breadcrumb"
      className={`flex items-center flex-wrap gap-1 text-xs text-base-content/50 ${className}`}
    >
      <Link
        to="/"
        className="flex items-center gap-1 hover:text-primary transition-colors focus:outline-none focus:ring-1 focus:ring-primary/40 rounded"
        aria-label={homeLabel}
      >
        <Home size={11} aria-hidden="true" />
        <span className="sr-only">{homeLabel}</span>
      </Link>

      {crumbs.map((crumb) => (
        <span key={crumb.href} className="flex items-center gap-1">
          <ChevronRight size={11} aria-hidden="true" className="text-base-content/30" />
          {crumb.isLast ? (
            <span className="font-semibold text-base-content/80" aria-current="page">
              {crumb.label}
            </span>
          ) : (
            <Link
              to={crumb.href}
              className="hover:text-primary transition-colors focus:outline-none focus:ring-1 focus:ring-primary/40 rounded"
            >
              {crumb.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}

import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';

/**
 * BreadcrumbNav — accessible breadcrumb trail.
 *
 * Renders a `<nav aria-label="breadcrumb">` with structured data markup and
 * keyboard-accessible links. The last item is marked `aria-current="page"`.
 *
 * @example
 * <BreadcrumbNav
 *   crumbs={[
 *     { label: 'Home', href: '/' },
 *     { label: 'Trips', href: '/trips' },
 *     { label: 'Morocco 2025' },
 *   ]}
 * />
 */
const BreadcrumbNav = ({
  crumbs = [],
  showHomeIcon = true,
  className = '',
}) => {
  if (!crumbs.length) return null;

  // Ensure the first crumb is always Home when showHomeIcon is true
  const allCrumbs = showHomeIcon && crumbs[0]?.href !== '/'
    ? [{ label: 'Home', href: '/' }, ...crumbs]
    : crumbs;

  return (
    <nav aria-label="Breadcrumb" className={className}>
      <ol
        className="flex flex-wrap items-center gap-1 text-sm text-base-content/50"
        itemScope
        itemType="https://schema.org/BreadcrumbList"
      >
        {allCrumbs.map((crumb, idx) => {
          const isLast = idx === allCrumbs.length - 1;
          const isFirst = idx === 0;

          return (
            <li
              key={`${crumb.href ?? crumb.label}-${idx}`}
              className="flex items-center gap-1"
              itemProp="itemListElement"
              itemScope
              itemType="https://schema.org/ListItem"
            >
              {!isFirst && (
                <ChevronRight
                  size={14}
                  className="text-base-content/30 flex-shrink-0"
                  aria-hidden="true"
                />
              )}

              {isLast || !crumb.href ? (
                <span
                  className={`font-semibold ${isLast ? 'text-base-content/80' : 'text-base-content/50'}`}
                  aria-current={isLast ? 'page' : undefined}
                  itemProp="name"
                >
                  {isFirst && showHomeIcon ? (
                    <span className="flex items-center gap-1">
                      <Home size={14} aria-hidden="true" />
                      <span className="sr-only">{crumb.label}</span>
                    </span>
                  ) : (
                    crumb.label
                  )}
                </span>
              ) : (
                <Link
                  to={crumb.href}
                  className="font-semibold hover:text-base-content transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50 rounded"
                  itemProp="item"
                >
                  {isFirst && showHomeIcon ? (
                    <span className="flex items-center gap-1">
                      <Home size={14} aria-hidden="true" />
                      <span className="sr-only">{crumb.label}</span>
                    </span>
                  ) : (
                    <span itemProp="name">{crumb.label}</span>
                  )}
                </Link>
              )}

              <meta itemProp="position" content={String(idx + 1)} />
            </li>
          );
        })}
      </ol>
    </nav>
  );
};

BreadcrumbNav.propTypes = {
  crumbs: PropTypes.arrayOf(
    PropTypes.shape({
      label: PropTypes.string.isRequired,
      href:  PropTypes.string,
    })
  ).isRequired,
  showHomeIcon: PropTypes.bool,
  className:    PropTypes.string,
};

export default BreadcrumbNav;

/**
 * TravelAdvisoryBanner
 *
 * A full-width, colour-coded advisory banner extracted from the inline
 * advisory divs in CityHub and CountryHub. Covers all four FCDO stances:
 *   normal            → renders nothing
 *   exercise_caution  → yellow
 *   advise_against    → orange
 *   advise_against_all → red (most severe)
 *
 * Features
 *   - Accessible role="alert" on non-normal levels
 *   - Dismissable (optional, controlled by `dismissable` prop)
 *   - Links to full FCDO advisory page when fcdo_slug is supplied
 *   - Shows last-checked date when advisory_checked_at is available
 *
 * Usage
 *   <TravelAdvisoryBanner destination={destination} />
 *   <TravelAdvisoryBanner
 *     advisoryStance="advise_against"
 *     advisorySummary="Some areas are considered high risk."
 *     fcdoSlug="nigeria"
 *     dismissable
 *   />
 */

import { useState } from 'react';
import { AlertTriangle, ShieldOff, AlertCircle, X, ExternalLink, Calendar } from 'lucide-react';
import PropTypes from 'prop-types';

// ─── Configuration ────────────────────────────────────────────────────────

const STANCE_CONFIG = {
  normal: null,
  exercise_caution: {
    Icon: AlertTriangle,
    badge: 'Exercise Caution',
    wrapperClass: 'border-yellow-400/50 bg-yellow-50 dark:bg-yellow-900/10',
    iconClass: 'text-yellow-600 dark:text-yellow-400',
    textClass: 'text-yellow-800 dark:text-yellow-300',
    badgeClass: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 border-yellow-300/60',
  },
  advise_against: {
    Icon: AlertCircle,
    badge: 'FCDO Advises Against Some Travel',
    wrapperClass: 'border-orange-400/50 bg-orange-50 dark:bg-orange-900/10',
    iconClass: 'text-orange-600 dark:text-orange-400',
    textClass: 'text-orange-800 dark:text-orange-300',
    badgeClass: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 border-orange-300/60',
  },
  advise_against_all: {
    Icon: ShieldOff,
    badge: 'FCDO Advises Against All Travel',
    wrapperClass: 'border-red-400/50 bg-red-50 dark:bg-red-900/10',
    iconClass: 'text-red-600 dark:text-red-400',
    textClass: 'text-red-800 dark:text-red-300',
    badgeClass: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-300/60',
  },
};

function formatDate(dateStr) {
  if (!dateStr) return null;
  try {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: 'numeric', month: 'short', year: 'numeric',
    });
  } catch {
    return null;
  }
}

// ─── Component ────────────────────────────────────────────────────────────

export default function TravelAdvisoryBanner({
  destination,
  advisoryStance: stanceProp,
  advisorySummary: summaryProp,
  advisoryCheckedAt: checkedAtProp,
  fcdoSlug: slugProp,
  dismissable = false,
  className = '',
}) {
  const [dismissed, setDismissed] = useState(false);

  // Accept either a full `destination` object or individual props
  const stance      = stanceProp       ?? destination?.advisory_stance;
  const summary     = summaryProp      ?? destination?.advisory_summary;
  const checkedAt   = checkedAtProp    ?? destination?.advisory_checked_at;
  const fcdoSlug    = slugProp         ?? destination?.fcdo_slug;

  const config = STANCE_CONFIG[stance];

  // Render nothing for normal or unknown stance, or if dismissed
  if (!config || dismissed) return null;

  const { Icon, badge, wrapperClass, iconClass, textClass, badgeClass } = config;
  const checkedDate = formatDate(checkedAt);

  return (
    <div
      role="alert"
      aria-label={`Travel advisory: ${badge}`}
      className={`relative rounded-xl border p-4 flex items-start gap-3 ${wrapperClass} ${className}`}
    >
      {/* Icon */}
      <Icon size={20} className={`flex-shrink-0 mt-0.5 ${iconClass}`} aria-hidden="true" />

      {/* Body */}
      <div className="flex-1 min-w-0 space-y-1.5">
        {/* Badge */}
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[11px] font-black uppercase tracking-widest ${badgeClass}`}>
          {badge}
        </span>

        {/* Summary text */}
        {summary && (
          <p className={`text-sm leading-relaxed ${textClass}`}>{summary}</p>
        )}

        {/* Footer row — checked date + FCDO link */}
        <div className="flex items-center flex-wrap gap-x-4 gap-y-1 pt-0.5">
          {checkedDate && (
            <span className={`flex items-center gap-1 text-xs opacity-70 ${textClass}`}>
              <Calendar size={11} aria-hidden="true" />
              Checked {checkedDate}
            </span>
          )}
          {fcdoSlug && (
            <a
              href={`https://www.gov.uk/foreign-travel-advice/${fcdoSlug}`}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex items-center gap-1 text-xs font-bold underline-offset-2 hover:underline ${textClass}`}
              aria-label="Read full FCDO travel advisory (opens in new tab)"
            >
              <ExternalLink size={11} aria-hidden="true" />
              Full FCDO advisory
            </a>
          )}
        </div>
      </div>

      {/* Dismiss button */}
      {dismissable && (
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className={`flex-shrink-0 p-1 rounded-lg opacity-60 hover:opacity-100 transition-opacity ${textClass}`}
          aria-label="Dismiss advisory banner"
        >
          <X size={16} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

TravelAdvisoryBanner.propTypes = {
  /** Pass the full destination object (advisory_stance, advisory_summary, advisory_checked_at, fcdo_slug will be extracted) */
  destination: PropTypes.shape({
    advisory_stance: PropTypes.string,
    advisory_summary: PropTypes.string,
    advisory_checked_at: PropTypes.string,
    fcdo_slug: PropTypes.string,
  }),
  /** Override: advisory stance key */
  advisoryStance: PropTypes.oneOf(['normal', 'exercise_caution', 'advise_against', 'advise_against_all']),
  /** Override: advisory summary text */
  advisorySummary: PropTypes.string,
  /** Override: last-checked ISO date string */
  advisoryCheckedAt: PropTypes.string,
  /** Override: FCDO country slug for the deep-link */
  fcdoSlug: PropTypes.string,
  /** Whether to show an X dismiss button */
  dismissable: PropTypes.bool,
  className: PropTypes.string,
};

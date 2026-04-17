import { Link } from 'react-router-dom';
import { MapPin, Globe, Star } from 'lucide-react';

/**
 * ProfileCard — reusable general-purpose profile card component.
 * Accepts a `profile` object with display_name/name, avatar_url, bio,
 * pronouns, home_city, travel_style, solo_travel_experience.
 *
 * Pass `linkTo` to make the card a clickable link to a profile page.
 * Pass `actions` (React node) to render action buttons in the card footer.
 */
export default function ProfileCard({ profile, linkTo, actions, compact = false }) {
  if (!profile) return null;

  const displayName = profile.display_name || profile.name || 'Solo Traveller';
  const initials = displayName
    .split(' ')
    .map(n => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const cardContent = (
    <>
      {/* Avatar + name header */}
      <div className={`flex items-center gap-3 ${compact ? '' : 'mb-3'}`}>
        <div className="avatar flex-shrink-0">
          <div className={`${compact ? 'w-10 h-10' : 'w-14 h-14'} rounded-full`}>
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt={displayName} className="object-cover" />
            ) : (
              <div
                className={`${compact ? 'w-10 h-10' : 'w-14 h-14'} rounded-full bg-brand-vibrant/15 flex items-center justify-center font-bold text-brand-vibrant ${compact ? 'text-sm' : 'text-lg'}`}
              >
                {initials}
              </div>
            )}
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <p className={`font-semibold text-base-content truncate ${compact ? 'text-sm' : 'text-base'}`}>
            {displayName}
          </p>
          {profile.pronouns && (
            <p className="text-xs text-base-content/50">{profile.pronouns}</p>
          )}
        </div>
      </div>

      {!compact && (
        <>
          {/* Bio */}
          {profile.bio && (
            <p className="text-sm text-base-content/70 line-clamp-2 mb-3">{profile.bio}</p>
          )}

          {/* Meta badges */}
          <div className="flex flex-wrap gap-2 text-xs text-base-content/60">
            {profile.home_city && (
              <span className="flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                {profile.home_city}
              </span>
            )}
            {profile.travel_style && (
              <span className="flex items-center gap-1">
                <Globe className="w-3 h-3" />
                {profile.travel_style}
              </span>
            )}
            {profile.solo_travel_experience && (
              <span className="flex items-center gap-1">
                <Star className="w-3 h-3" />
                {profile.solo_travel_experience}
              </span>
            )}
          </div>
        </>
      )}

      {/* Actions slot */}
      {actions && <div className="mt-3 pt-3 border-t border-base-200">{actions}</div>}
    </>
  );

  const classes = `card bg-base-100 shadow-sm hover:shadow-md transition-shadow ${compact ? 'p-3' : 'p-4'}`;

  if (linkTo) {
    return (
      <Link to={linkTo} className={classes}>
        {cardContent}
      </Link>
    );
  }

  return <div className={classes}>{cardContent}</div>;
}

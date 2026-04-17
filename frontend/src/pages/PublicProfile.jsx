import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { MapPin, Globe, Calendar, UserX } from 'lucide-react';
import api from '../lib/api';

export default function PublicProfile() {
  const { id } = useParams();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    api.get(`/users/${id}/public`).then(res => {
      setProfile(res.data.data.profile);
    }).catch(err => {
      if (err.response?.status === 404) setNotFound(true);
    }).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="loading loading-spinner loading-lg" /></div>;

  if (notFound) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <UserX className="w-16 h-16 mx-auto mb-4 text-base-content/30" />
        <h1 className="text-2xl font-bold mb-2">Profile Not Found</h1>
        <p className="text-base-content/60 mb-4">This profile doesn't exist or is private.</p>
        <Link to="/" className="btn btn-primary">Go Home</Link>
      </div>
    </div>
  );

  const displayName = profile?.display_name || profile?.name || 'Solo Traveller';

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="card bg-base-100 shadow-sm">
        <div className="card-body">
          <div className="flex gap-4 items-center">
            <div className="avatar">
              <div className="w-20 h-20 rounded-full">
                {profile?.avatar_url
                  ? <img src={profile.avatar_url} alt={displayName} />
                  : <div className="w-20 h-20 rounded-full bg-brand-vibrant/20 flex items-center justify-center text-3xl font-bold text-brand-vibrant">{displayName[0]?.toUpperCase()}</div>
                }
              </div>
            </div>
            <div>
              <h1 className="text-2xl font-bold">{displayName}</h1>
              {profile?.pronouns && <p className="text-sm text-base-content/60">{profile.pronouns}</p>}
              <div className="flex flex-wrap gap-3 mt-1 text-sm text-base-content/60">
                {profile?.home_city && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{profile.home_city}</span>}
                {profile?.travel_style && <span className="flex items-center gap-1"><Globe className="w-3 h-3" />{profile.travel_style}</span>}
                <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />Member since {new Date(profile?.created_at || Date.now()).getFullYear()}</span>
              </div>
            </div>
          </div>
          {profile?.bio && <p className="mt-4 text-base-content/80">{profile.bio}</p>}
          {profile?.solo_travel_experience && (
            <div className="mt-3 pt-3 border-t border-base-200">
              <span className="badge badge-outline">{profile.solo_travel_experience} solo traveller</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { Edit, MapPin, Globe, Calendar } from 'lucide-react';
import api from '../lib/api';
import TravelStatsWidget from '../components/TravelStatsWidget';
import TravelPersonaBadge from '../components/TravelPersonaBadge';
import ProfileCompletenessCard from '../components/ProfileCompletenessCard';

export default function Profile() {
  const { user } = useAuthStore();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await api.get('/users/me/profile');
        setProfile(res.data.data.profile);
      } catch (err) {
        console.error('Failed to fetch profile', err);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="loading loading-spinner loading-lg" /></div>;

  const displayName = profile?.display_name || user?.name || 'Solo Traveller';

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="card bg-base-100 shadow-sm mb-6">
        <div className="card-body">
          <div className="flex items-start justify-between">
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
                {profile?.bio && <p className="text-base-content/80 mt-1 max-w-md">{profile.bio}</p>}
                <div className="flex flex-wrap gap-3 mt-2 text-sm text-base-content/60">
                  {profile?.home_city && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{profile.home_city}</span>}
                  {profile?.travel_style && <span className="flex items-center gap-1"><Globe className="w-3 h-3" />{profile.travel_style}</span>}
                  <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />Member since {new Date(user?.created_at || Date.now()).getFullYear()}</span>
                </div>
              </div>
            </div>
            <Link to="/profile/edit" className="btn btn-outline btn-sm gap-1"><Edit className="w-4 h-4" />Edit</Link>
          </div>
          {profile?.solo_travel_experience && (
            <div className="mt-3 pt-3 border-t border-base-200">
              <span className="badge badge-outline">{profile.solo_travel_experience} solo traveller</span>
            </div>
          )}
          {profile?.travel_style && (
            <div className="mt-3">
              <TravelPersonaBadge dominantStyle={profile.travel_style} size="sm" showDescription />
            </div>
          )}
        </div>
      </div>
      <div className="card bg-base-100 shadow-sm mb-6">
        <div className="card-body">
          <h2 className="card-title text-base">Profile Completeness</h2>
          <ProfileCompletenessCard />
        </div>
      </div>
      <TravelStatsWidget />
    </div>
  );
}

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Save, ArrowLeft } from 'lucide-react';
import api from '../lib/api';
import toast from 'react-hot-toast';

const PRONOUNS_OPTIONS = ['He/Him', 'She/Her', 'They/Them', 'He/They', 'She/They', 'Prefer not to say', 'Other'];
const EXPERIENCE_OPTIONS = ['First-time', 'Beginner', 'Intermediate', 'Experienced', 'Expert'];
const TRAVEL_STYLES = ['Budget', 'Mid-range', 'Luxury', 'Backpacker', 'Adventure', 'Cultural', 'Relaxation', 'Work & Travel'];

export default function ProfileEdit() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', display_name: '', bio: '', home_city: '', pronouns: '', solo_travel_experience: '', travel_style: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/users/me/profile').then(res => {
      const p = res.data.data.profile;
      setForm({
        name: p.name || '',
        display_name: p.display_name || '',
        bio: p.bio || '',
        home_city: p.home_city || '',
        pronouns: p.pronouns || '',
        solo_travel_experience: p.solo_travel_experience || '',
        travel_style: p.travel_style || '',
      });
    }).finally(() => setLoading(false));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put('/users/me/profile', form);
      toast.success('Profile updated!');
      navigate('/profile');
    } catch (err) {
      toast.error('Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="loading loading-spinner loading-lg" /></div>;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <button onClick={() => navigate(-1)} className="btn btn-ghost btn-sm gap-1 mb-4"><ArrowLeft className="w-4 h-4" />Back</button>
      <h1 className="text-2xl font-bold mb-6">Edit Profile</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="form-control">
          <label className="label"><span className="label-text">Full Name</span></label>
          <input className="input input-bordered" value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} />
        </div>
        <div className="form-control">
          <label className="label"><span className="label-text">Display Name</span></label>
          <input className="input input-bordered" value={form.display_name} onChange={e => setForm(f => ({...f, display_name: e.target.value}))} />
        </div>
        <div className="form-control">
          <label className="label"><span className="label-text">Pronouns</span></label>
          <select className="select select-bordered" value={form.pronouns} onChange={e => setForm(f => ({...f, pronouns: e.target.value}))}>
            <option value="">Select pronouns (optional)</option>
            {PRONOUNS_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div className="form-control">
          <label className="label"><span className="label-text">Bio</span></label>
          <textarea className="textarea textarea-bordered h-24" value={form.bio} onChange={e => setForm(f => ({...f, bio: e.target.value}))} maxLength={500} />
          <label className="label"><span className="label-text-alt">{form.bio.length}/500</span></label>
        </div>
        <div className="form-control">
          <label className="label"><span className="label-text">Home City</span></label>
          <input className="input input-bordered" value={form.home_city} onChange={e => setForm(f => ({...f, home_city: e.target.value}))} />
        </div>
        <div className="form-control">
          <label className="label"><span className="label-text">Solo Travel Experience</span></label>
          <select className="select select-bordered" value={form.solo_travel_experience} onChange={e => setForm(f => ({...f, solo_travel_experience: e.target.value}))}>
            <option value="">Select experience level</option>
            {EXPERIENCE_OPTIONS.map(e => <option key={e} value={e}>{e}</option>)}
          </select>
        </div>
        <div className="form-control">
          <label className="label"><span className="label-text">Travel Style</span></label>
          <select className="select select-bordered" value={form.travel_style} onChange={e => setForm(f => ({...f, travel_style: e.target.value}))}>
            <option value="">Select travel style</option>
            {TRAVEL_STYLES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="pt-4">
          <button type="submit" disabled={saving} className="btn btn-primary w-full gap-2">
            {saving ? <span className="loading loading-spinner loading-sm" /> : <Save className="w-4 h-4" />}
            Save Changes
          </button>
        </div>
      </form>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../lib/api';
import toast from 'react-hot-toast';
import { getErrorMessage } from '../lib/utils';
import { ArrowLeft } from 'lucide-react';
import PackingList from '../components/PackingList';
import Loading from '../components/Loading';

export default function TripPackingPage() {
  const { id } = useParams();
  const [trip, setTrip] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/trips/${id}`)
      .then(r => setTrip(r.data.data))
      .catch(err => toast.error(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <Loading />;

  return (
    <div className="max-w-2xl mx-auto py-6 px-4">
      <div className="flex items-center gap-3 mb-6">
        <Link to={`/trips/${id}`} className="p-2 rounded-lg hover:bg-base-200 text-base-content/60 hover:text-base-content transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-xl font-black text-base-content">{trip?.name} — Packing List</h1>
          <p className="text-sm text-base-content/50">{trip?.destination}</p>
        </div>
      </div>
      <PackingList tripId={id} tripName={trip?.name} />
    </div>
  );
}

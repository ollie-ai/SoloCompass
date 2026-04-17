import { useParams, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import ShareTripModal from '../components/trip/ShareTripModal';
import { useNavigate } from 'react-router-dom';

export default function TripSharePage() {
  const { id } = useParams();
  const navigate = useNavigate();

  return (
    <div className="max-w-md mx-auto py-6 px-4">
      <div className="flex items-center gap-3 mb-6">
        <Link to={`/trips/${id}`} className="p-2 rounded-lg hover:bg-base-200 text-base-content/60 hover:text-base-content transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-xl font-black text-base-content">Share Trip</h1>
      </div>
      <ShareTripModal
        tripId={id}
        tripName=""
        onClose={() => navigate(`/trips/${id}`)}
      />
    </div>
  );
}

import { BookOpen, Clock, MapPin, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

const GuideCard = ({ guide, className = '' }) => {
  const { slug, title, excerpt, category, destination, cover_image, read_time_minutes } = guide;

  return (
    <div className={`card bg-base-100 shadow-sm hover:shadow-md transition-shadow border border-base-200 ${className}`}>
      {cover_image && (
        <figure className="h-48 overflow-hidden">
          <img src={cover_image} alt={title} className="w-full h-full object-cover" />
        </figure>
      )}
      <div className="card-body p-4">
        {category && (
          <div className="badge badge-primary badge-sm capitalize">{category.replace('-', ' ')}</div>
        )}
        <h3 className="card-title text-base font-semibold line-clamp-2">{title}</h3>
        {excerpt && <p className="text-sm text-base-content/70 line-clamp-3">{excerpt}</p>}
        <div className="flex items-center gap-3 text-xs text-base-content/50 mt-2">
          {destination && (
            <span className="flex items-center gap-1"><MapPin size={12} />{destination}</span>
          )}
          {read_time_minutes && (
            <span className="flex items-center gap-1"><Clock size={12} />{read_time_minutes} min read</span>
          )}
        </div>
        <div className="card-actions justify-end mt-2">
          <Link to={`/guides/${slug}`} className="btn btn-ghost btn-sm gap-1 text-primary">
            Read guide <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </div>
  );
};

export default GuideCard;

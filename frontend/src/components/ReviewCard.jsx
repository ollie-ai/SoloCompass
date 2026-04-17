import { useState, useEffect, memo } from 'react';
import PropTypes from 'prop-types';
import { Star, ThumbsUp, MapPin } from 'lucide-react';
import api from '../lib/api';
import ReportButton from './ReportButton';

const ReviewCard = memo(function ReviewCard({ review, onHelpful }) {
  const [isHelpful, setIsHelpful] = useState(false);
  const [helpfulCount, setHelpfulCount] = useState(review.helpfulCount);

  const handleHelpful = async () => {
    try {
      if (isHelpful) {
        await api.delete(`/reviews/${review.id}/helpful`);
        setHelpfulCount(prev => prev - 1);
      } else {
        await api.post(`/reviews/${review.id}/helpful`);
        setHelpfulCount(prev => prev + 1);
      }
      setIsHelpful(!isHelpful);
    } catch (error) {
      console.error('Error marking helpful:', error);
    }
  };

  const renderStars = (rating, maxStars = 5) => {
    return [...Array(maxStars)].map((_, i) => (
      <Star
        key={`star-${i}`}
        size={14}
        className={i < rating ? 'text-amber-400 fill-amber-400' : 'text-base-content/20'}
      />
    ));
  };

  return (
    <div className="bg-base-100 rounded-xl p-6 shadow-sm border border-base-300/50">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-bold">
            {review.author?.name?.charAt(0).toUpperCase() || 'A'}
          </div>
          <div>
            <p className="font-semibold text-base-content">{review.author?.name || 'Anonymous'}</p>
            <p className="text-xs text-base-content/50">
              {review.createdAt && new Date(review.createdAt).toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'short',
                year: 'numeric'
              })}
            </p>
          </div>
        </div>
        {review.isVerified && (
          <span className="px-2 py-1 bg-success/20 text-success text-xs font-medium rounded-full">
            Verified Solo Trip
          </span>
        )}
      </div>

      {/* Venue Info */}
      {(review.venueName || review.destination) && (
        <div className="flex items-center gap-2 text-sm text-base-content/60 mb-4">
          <MapPin size={14} />
          <span>{review.venueName || review.destination}</span>
          {review.venueType && (
            <span className="px-2 py-0.5 bg-base-200 text-xs capitalize rounded">
              {review.venueType}
            </span>
          )}
        </div>
      )}

      {/* Ratings */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <div>
          <p className="text-xs text-base-content/50 mb-1">Overall</p>
          <div className="flex">{renderStars(review.overallRating)}</div>
        </div>
        {review.soloFriendlyRating && (
          <div>
            <p className="text-xs text-base-content/50 mb-1">Solo-Friendly</p>
            <div className="flex">{renderStars(review.soloFriendlyRating)}</div>
          </div>
        )}
        {review.safetyRating && (
          <div>
            <p className="text-xs text-base-content/50 mb-1">Safety</p>
            <div className="flex">{renderStars(review.safetyRating)}</div>
          </div>
        )}
        {review.valueRating && (
          <div>
            <p className="text-xs text-base-content/50 mb-1">Value</p>
            <div className="flex">{renderStars(review.valueRating)}</div>
          </div>
        )}
      </div>

      {/* Content */}
      <h4 className="font-semibold text-base-content mb-2">{review.title}</h4>
      <p className="text-base-content/60 text-sm leading-relaxed mb-4">{review.content}</p>

      {/* Tags */}
      {review.tags && review.tags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {review.tags.map((tag) => (
            <span key={tag} className="px-2 py-1 bg-primary/10 text-primary text-xs rounded-full">
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Helpful */}
      <div className="flex items-center justify-between gap-3">
        <button
          onClick={handleHelpful}
          className={`flex items-center gap-2 text-sm transition-colors ${
            isHelpful 
              ? 'text-primary' 
              : 'text-base-content/50 hover:text-primary'
          }`}
        >
          <ThumbsUp size={16} className={isHelpful ? 'fill-current' : ''} />
          <span>Helpful ({helpfulCount})</span>
        </button>
        <ReportButton compact reportedEntityType="review" entityId={review.id} />
      </div>
    </div>
  );
});

ReviewCard.propTypes = {
  review: PropTypes.shape({
    id: PropTypes.string.isRequired,
    author: PropTypes.object,
    title: PropTypes.string,
    content: PropTypes.string,
    overallRating: PropTypes.number,
    soloFriendlyRating: PropTypes.number,
    safetyRating: PropTypes.number,
    valueRating: PropTypes.number,
    venueName: PropTypes.string,
    venueType: PropTypes.string,
    destination: PropTypes.string,
    isVerified: PropTypes.bool,
    tags: PropTypes.arrayOf(PropTypes.string),
    helpfulCount: PropTypes.number,
    createdAt: PropTypes.string,
  }).isRequired,
  onHelpful: PropTypes.func,
};

export default ReviewCard;

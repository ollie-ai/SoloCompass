import PropTypes from 'prop-types';
import { motion } from 'framer-motion';
import BuddyCard from './BuddyCard';

/**
 * BuddyDiscoveryGrid – reusable grid of BuddyCard items used in discovery flows.
 * Handles empty/loading states and card animation.
 */
function BuddyDiscoveryGrid({ matches, onConnect, onSkip, loading, getMatchReasons, myProfile }) {
  if (!matches || matches.length === 0) return null;

  const getProfileCompleteness = (match) => {
    if (!match) return { percent: 0, label: 'Incomplete' };
    const fields = ['bio', 'travelStyle', 'destination', 'startDate', 'endDate'];
    const filled = fields.filter((f) => match[f]).length;
    const percent = Math.round((filled / fields.length) * 100);
    if (percent >= 80) return { percent, label: 'Complete' };
    if (percent >= 50) return { percent, label: 'Mostly complete' };
    return { percent, label: 'Incomplete' };
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
      {matches.map((match, index) => (
        <motion.div
          key={match.userId}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: index * 0.05, ease: [0.16, 1, 0.3, 1] }}
        >
          <BuddyCard
            match={match}
            onConnect={onConnect}
            onSkip={onSkip}
            loading={loading}
            matchReasons={getMatchReasons ? getMatchReasons(match) : match.matchReasons}
            profileCompleteness={getProfileCompleteness(match)}
          />
        </motion.div>
      ))}
    </div>
  );
}

BuddyDiscoveryGrid.propTypes = {
  matches: PropTypes.array.isRequired,
  onConnect: PropTypes.func,
  onSkip: PropTypes.func,
  loading: PropTypes.bool,
  getMatchReasons: PropTypes.func,
  myProfile: PropTypes.object,
};

export default BuddyDiscoveryGrid;

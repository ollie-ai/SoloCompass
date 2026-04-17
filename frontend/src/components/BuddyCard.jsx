/**
 * BuddyCard – named component wrapper around MatchCard for use in buddy
 * discovery flows. Props are identical to MatchCard.
 */
import MatchCard from './MatchCard';

const BuddyCard = (props) => <MatchCard {...props} />;

export default BuddyCard;

/**
 * TravelPersonaBadge — displays a labelled badge for a user's Travel DNA persona.
 *
 * The persona label is derived from quiz_results.dominant_style + travel_persona
 * (if set) via a deterministic mapping.
 *
 * Props:
 *   dominantStyle   — string from quiz_results (e.g. "adventure", "culture")
 *   travelPersona   — optional override string stored in quiz_results.travel_persona
 *   size            — 'sm' | 'md' | 'lg'
 *   showDescription — show a short description line below the badge
 */
export const TRAVEL_PERSONAS = {
  adventure: {
    label: 'The Adventurer',
    emoji: '🧗',
    color: 'bg-orange-100 text-orange-700 border-orange-200',
    description: 'Thrills over comfort — you seek the path less taken.',
  },
  culture: {
    label: 'The Cultural Explorer',
    emoji: '🏛️',
    color: 'bg-purple-100 text-purple-700 border-purple-200',
    description: 'History, art, and local life fuel your travels.',
  },
  cultural: {
    label: 'The Cultural Explorer',
    emoji: '🏛️',
    color: 'bg-purple-100 text-purple-700 border-purple-200',
    description: 'History, art, and local life fuel your travels.',
  },
  relaxation: {
    label: 'The Mindful Wanderer',
    emoji: '🌅',
    color: 'bg-sky-100 text-sky-700 border-sky-200',
    description: 'Rest, recharge, and savour every slow moment.',
  },
  budget: {
    label: 'The Savvy Nomad',
    emoji: '🎒',
    color: 'bg-green-100 text-green-700 border-green-200',
    description: 'More miles per dollar — efficiency is your superpower.',
  },
  backpacker: {
    label: 'The Backpacker',
    emoji: '🎒',
    color: 'bg-lime-100 text-lime-700 border-lime-200',
    description: 'Hostel life, new friends, and raw experiences.',
  },
  luxury: {
    label: 'The Luxury Seeker',
    emoji: '✨',
    color: 'bg-amber-100 text-amber-700 border-amber-200',
    description: 'You know quality — and you travel for the finer things.',
  },
  social: {
    label: 'The Social Butterfly',
    emoji: '🦋',
    color: 'bg-pink-100 text-pink-700 border-pink-200',
    description: 'Connecting with people is the whole point of travel.',
  },
  solo: {
    label: 'The Lone Wolf',
    emoji: '🐺',
    color: 'bg-slate-100 text-slate-700 border-slate-200',
    description: 'Complete freedom — your itinerary, your rules.',
  },
  foodie: {
    label: 'The Culinary Adventurer',
    emoji: '🍜',
    color: 'bg-red-100 text-red-700 border-red-200',
    description: 'You travel with your stomach — every meal is a discovery.',
  },
};

const FALLBACK_PERSONA = {
  label: 'Solo Traveller',
  emoji: '✈️',
  color: 'bg-brand-vibrant/10 text-brand-vibrant border-brand-vibrant/20',
  description: 'Your travel style is still being discovered.',
};

export function getPersona(dominantStyle, travelPersona) {
  const key = (travelPersona || dominantStyle || '').toLowerCase();
  return TRAVEL_PERSONAS[key] || FALLBACK_PERSONA;
}

export default function TravelPersonaBadge({ dominantStyle, travelPersona, size = 'md', showDescription = false }) {
  const persona = getPersona(dominantStyle, travelPersona);

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-3 py-1',
    lg: 'text-base px-4 py-1.5',
  };

  const emojiSizes = { sm: 'text-base', md: 'text-lg', lg: 'text-xl' };

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <span className={`inline-flex items-center gap-1.5 rounded-full border font-semibold ${persona.color} ${sizeClasses[size]}`}>
        <span className={emojiSizes[size]}>{persona.emoji}</span>
        {persona.label}
      </span>
      {showDescription && (
        <p className="text-xs text-base-content/60 mt-0.5">{persona.description}</p>
      )}
    </div>
  );
}

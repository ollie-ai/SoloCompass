export default function DestinationGrid({
  destinations = [],
  renderCard,
  className = 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5',
}) {
  if (!destinations.length) return null;

  const getDestinationKey = (destination, index) => {
    if (destination?.id) return `id-${destination.id}`;
    if (destination?.slug) return `slug-${destination.slug}`;
    if (destination?.name && destination?.country) return `${destination.name}-${destination.country}`;
    if (destination?.name) return `name-${destination.name}`;
    return `destination-${index}`;
  };

  return (
    <div className={className}>
      {destinations.map((destination, index) => (
        <div key={getDestinationKey(destination, index)}>
          {renderCard ? renderCard(destination, index) : null}
        </div>
      ))}
    </div>
  );
}

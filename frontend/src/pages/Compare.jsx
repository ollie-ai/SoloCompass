import SEO from '../components/SEO';
import DestinationCompare from '../components/destinations/DestinationCompare';

function Compare() {
  return (
    <>
      <SEO title="Compare Destinations | SoloCompass" description="Compare destinations side-by-side for solo travel" />
      <div className="max-w-5xl mx-auto px-4 py-8">
        <DestinationCompare />
      </div>
    </>
  );
}

export default Compare;

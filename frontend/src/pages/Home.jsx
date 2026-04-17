import HomeHero from '../components/marketing/HomeHero';
import CapabilityChips from '../components/marketing/CapabilityChips';
import StepCards from '../components/marketing/StepCards';
import TrustedSources from '../components/marketing/TrustedSources';
import FeatureGrid from '../components/marketing/FeatureGrid';
import FoundingExplorer from '../components/marketing/FoundingExplorer';
import TestimonialsSection from '../components/marketing/TestimonialsSection';
import PricingSection from '../components/marketing/PricingSection';
import FAQAccordion from '../components/marketing/FAQAccordion';
import FinalCTA from '../components/marketing/FinalCTA';
import SEO from '../components/SEO';

const Home = () => {
  return (
    <>
      <SEO 
        title="SoloCompass — Your AI Solo Travel Companion"
        description="Plan safer, smarter solo trips with AI-powered itineraries, real-time safety alerts, and personalized travel guides."
      />
      <main id="home-main">
        <HomeHero />
        <CapabilityChips />
        <StepCards />
        <TrustedSources />
        <FeatureGrid />
        <FoundingExplorer />
        <TestimonialsSection />
        <PricingSection />
        <FAQAccordion />
        <FinalCTA />
      </main>
    </>
  );
};

export default Home;

import SEO from '../components/SEO';
import OnboardingWizard from '../components/OnboardingWizard';

export default function Onboarding() {
  return (
    <div className="min-h-screen bg-base-200 pt-20 pb-16">
      <SEO title="Onboarding - SoloCompass" description="Set up your account, first trip, and safety preferences." />
      <div className="max-w-3xl mx-auto px-4">
        <OnboardingWizard />
      </div>
    </div>
  );
}

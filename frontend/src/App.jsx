import { useEffect, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { ErrorBoundary } from 'react-error-boundary';
import { useAuthStore } from './stores/authStore';
import { useThemeStore } from './stores/themeStore';
import { initErrorCollector } from './lib/errorCollector';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import CookieConsent from './components/CookieConsent';
import CallModal from './components/CallModal';
import { useTelemetry } from './hooks/useTelemetry';
const Home = lazy(() => import('./pages/Home'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const Settings = lazy(() => import('./pages/Settings'));
const Quiz = lazy(() => import('./pages/Quiz'));
const Destinations = lazy(() => import('./pages/Destinations'));
const DestinationDetail = lazy(() => import('./pages/DestinationDetail'));
const CountryHub = lazy(() => import('./pages/CountryHub'));
const CityHub = lazy(() => import('./pages/CityHub'));
const Trips = lazy(() => import('./pages/Trips'));
const TripDetail = lazy(() => import('./pages/TripDetail'));
const NewTrip = lazy(() => import('./pages/NewTrip'));
const Admin = lazy(() => import('./pages/AdminNew'));
const Advisories = lazy(() => import('./pages/Advisories'));
const Reviews = lazy(() => import('./pages/Reviews'));
const Buddies = lazy(() => import('./pages/Buddies'));
const Terms = lazy(() => import('./pages/Terms'));
const Privacy = lazy(() => import('./pages/Privacy'));
const Cookies = lazy(() => import('./pages/Cookies'));
const Legal = lazy(() => import('./pages/Legal'));
const Partnerships = lazy(() => import('./pages/Partnerships'));
const EmailPreview = lazy(() => import('./pages/EmailPreview'));
const Safety = lazy(() => import('./pages/Safety'));
const Help = lazy(() => import('./pages/Help'));
const OAuthCallback = lazy(() => import('./pages/OAuthCallback'));
const Contact = lazy(() => import('./pages/Contact'));
const About = lazy(() => import('./pages/About'));
const Docs = lazy(() => import('./pages/Docs'));
const Features = lazy(() => import('./pages/Features'));
const Pricing = lazy(() => import('./pages/Pricing'));
const SafetyInfo = lazy(() => import('./pages/SafetyInfo'));
const EmergencyPhrases = lazy(() => import('./pages/EmergencyPhrases'));
const Translator = lazy(() => import('./pages/Translator'));
const PinkPath = lazy(() => import('./pages/PinkPath'));
const CrimeMap = lazy(() => import('./pages/CrimeMap'));
const NotFound = lazy(() => import('./pages/NotFound'));
const Notifications = lazy(() => import('./pages/Notifications'));
const Messages = lazy(() => import('./pages/Messages'));
const Checkout = lazy(() => import('./pages/Checkout'));
const GuardianAcknowledge = lazy(() => import('./pages/GuardianAcknowledge'));
const GuardianDecline = lazy(() => import('./pages/GuardianDecline'));
const SharedTrip = lazy(() => import('./pages/SharedTrip'));
const BottomNav = lazy(() => import('./components/BottomNav'));
const VerifyEmail = lazy(() => import('./pages/VerifyEmail'));
const MagicLink = lazy(() => import('./pages/MagicLink'));
const Profile = lazy(() => import('./pages/Profile'));
const ProfileEdit = lazy(() => import('./pages/ProfileEdit'));
const PublicProfile = lazy(() => import('./pages/PublicProfile'));
const Onboarding = lazy(() => import('./pages/Onboarding'));

function LoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-brand-vibrant/20 border-t-brand-vibrant rounded-full animate-spin" />
    </div>
  );
}

function ErrorFallback({ error, resetErrorBoundary }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-base-100 rounded-xl shadow-lg p-8 text-center">
        <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
          <svg className="w-8 h-8 text-error" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Something went wrong</h2>
        <p className="text-gray-600 mb-6">
          We encountered an unexpected error. Please try again or refresh the page.
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Refresh Page
          </button>
          <button
            onClick={resetErrorBoundary}
            className="px-4 py-2 bg-brand-vibrant text-white rounded-lg hover:opacity-90 transition-opacity"
          >
            Try Again
          </button>
        </div>
        {import.meta.env.DEV && (
          <details className="mt-6 text-left">
            <summary className="text-sm text-gray-500 cursor-pointer">Error details</summary>
            <pre className="mt-2 p-3 bg-gray-100 rounded text-xs text-error overflow-auto">
              {error.message}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
}

function App() {
  const { initialize, isLoading } = useAuthStore();
  const { theme, initialize: initTheme, isInitialized } = useThemeStore();

  useEffect(() => {
    initialize();
    initTheme();
  }, [initialize, initTheme]);

  useEffect(() => {
    initErrorCollector();
  }, []);

  useEffect(() => {
    if ('serviceWorker' in navigator && import.meta.env.PROD) {
        navigator.serviceWorker.register('/sw.js')
        .catch((error) => {
          console.error('[App] SW registration failed:', error);
        });
    }
  }, []);

  useEffect(() => {
    if (theme === 'system') {
      const isDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
      document.documentElement.setAttribute('data-theme', isDark ? 'solocompass-dark' : 'solocompass');
    } else {
      document.documentElement.setAttribute('data-theme', theme);
    }
  }, [theme]);

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <PageTracker />
        <Toaster position="top-right" />
        <CookieConsent />
        <CallModal />
        <Suspense fallback={<LoadingFallback />}>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Home />} />
            <Route path="/features" element={<Features />} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/safety-info" element={<SafetyInfo />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/auth/google/callback" element={<OAuthCallback provider="google" />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/reset-password/:token" element={<ResetPassword />} />
            <Route path="/verify-email/:token" element={<VerifyEmail />} />
            <Route path="/magic-link" element={<MagicLink />} />
            <Route path="/profile/:id" element={<PublicProfile />} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <Settings />
                </ProtectedRoute>
              }
            />
            <Route
              path="/notifications"
              element={
                <ProtectedRoute>
                  <Notifications />
                </ProtectedRoute>
              }
            />
            <Route
              path="/messages"
              element={
                <ProtectedRoute>
                  <Messages />
                </ProtectedRoute>
              }
            />
            <Route
              path="/checkout"
              element={
                <ProtectedRoute>
                  <Checkout />
                </ProtectedRoute>
              }
            />
            <Route
              path="/quiz"
              element={<Quiz />}
            />
            <Route
              path="/onboarding"
              element={
                <ProtectedRoute>
                  <Onboarding />
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile/edit"
              element={
                <ProtectedRoute>
                  <ProfileEdit />
                </ProtectedRoute>
              }
            />
            <Route
              path="/destinations"
              element={
                <ProtectedRoute>
                  <Destinations />
                </ProtectedRoute>
              }
            />
            <Route
              path="/destinations/countries/:slug"
              element={
                <ProtectedRoute>
                  <CountryHub />
                </ProtectedRoute>
              }
            />
            <Route
              path="/destinations/cities/:slug"
              element={
                <ProtectedRoute>
                  <CityHub />
                </ProtectedRoute>
              }
            />
            <Route
              path="/destinations/:id"
              element={
                <ProtectedRoute>
                  <DestinationDetail />
                </ProtectedRoute>
              }
            />
            <Route
              path="/trips"
              element={
                <ProtectedRoute>
                  <Trips />
                </ProtectedRoute>
              }
            />
            <Route
              path="/trips/new"
              element={
                <ProtectedRoute>
                  <NewTrip />
                </ProtectedRoute>
              }
            />
            <Route
              path="/trips/:id"
              element={
                <ProtectedRoute>
                  <TripDetail />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin"
              element={
                <ProtectedRoute adminOnly={true}>
                  <Admin />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/:tab"
              element={
                <ProtectedRoute adminOnly={true}>
                  <Admin />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/emails"
              element={
                <ProtectedRoute adminOnly={true}>
                  <EmailPreview />
                </ProtectedRoute>
              }
            />
            <Route
              path="/advisories"
              element={
                <ProtectedRoute>
                  <Advisories />
                </ProtectedRoute>
              }
            />
            <Route
              path="/safety"
              element={
                <ProtectedRoute>
                  <Safety />
                </ProtectedRoute>
              }
            />
            <Route
              path="/safety/emergency-phrases"
              element={
                <ProtectedRoute>
                  <EmergencyPhrases />
                </ProtectedRoute>
              }
            />
            <Route
              path="/safety/translator"
              element={
                <ProtectedRoute>
                  <Translator />
                </ProtectedRoute>
              }
            />
            <Route
              path="/safety/pink-path"
              element={
                <ProtectedRoute>
                  <PinkPath />
                </ProtectedRoute>
              }
            />
            <Route
              path="/safety/crime-map"
              element={
                <ProtectedRoute>
                  <CrimeMap />
                </ProtectedRoute>
              }
            />
            <Route path="/reviews" element={<Reviews />} />
            <Route path="/reviews/new" element={
              <ProtectedRoute>
                <Reviews />
              </ProtectedRoute>
            } />
            <Route path="/buddies" element={
              <ProtectedRoute>
                <Buddies />
              </ProtectedRoute>
            } />
            <Route path="/terms" element={<Terms />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/cookies" element={<Cookies />} />
            <Route path="/legal" element={<Legal />} />
            <Route path="/help" element={<Help />} />
            <Route path="/docs" element={<Docs />} />
            <Route path="/partnerships" element={<Partnerships />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/about" element={<About />} />
            <Route path="/guardian/acknowledge/:token" element={<GuardianAcknowledge />} />
            <Route path="/guardian/decline/:token" element={<GuardianDecline />} />
            <Route path="/trips/shared/:shareCode" element={<SharedTrip />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
        </Suspense>
        <BottomNav />
      </BrowserRouter>
    </ErrorBoundary>
  );
}

function PageTracker() {
  const location = useLocation();
  const { isLoading } = useAuthStore();
  const { trackPageView } = useTelemetry();

  useEffect(() => {
    if (!isLoading) {
      trackPageView(location.pathname + location.search);
    }
  }, [location, isLoading, trackPageView]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-brand-vibrant/20 border-t-brand-vibrant rounded-full animate-spin" />
      </div>
    );
  }

  return null;
}

export default App;

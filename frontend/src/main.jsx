import React from 'react'
import ReactDOM from 'react-dom/client'
import { ErrorBoundary } from 'react-error-boundary'
import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import App from './App.jsx'
import { I18nProvider } from './i18n/I18nProvider'
import { trackFrontendError } from './lib/errorTracking'
import './index.css'
import { reportWebVitals } from './hooks/useWebVitals.js'

// Bootstrap Google Analytics using the Vite env variable (resolved at build time)
const gaId = import.meta.env.VITE_GA_ID;
if (gaId) {
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${gaId}`;
  document.head.appendChild(script);
  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = gtag;
  gtag('js', new Date());
  gtag('config', gaId);
}

function ErrorFallback({ error, resetErrorBoundary }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-mesh p-4">
      <div className="max-w-md w-full text-center">
        <div className="glass-card p-10 rounded-xl">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6 text-error">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-2xl font-black text-base-content mb-4">Something went wrong</h1>
          <p className="text-base-content/60 font-medium mb-8">
            We're sorry, but something unexpected happened. Please try refreshing the page.
          </p>
          <div className="space-y-4">
            <button
              onClick={resetErrorBoundary}
              className="w-full py-4 px-6 bg-brand-vibrant text-white rounded-xl font-black hover:bg-green-600 transition-colors"
            >
              Try Again
            </button>
            <button
              onClick={() => window.location.href = '/'}
              className="w-full py-4 px-6 border-2 border-base-300 text-base-content/80 rounded-xl font-black hover:bg-base-200 transition-colors"
            >
              Go Home
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// Inject Vercel Analytics script in production (consent-free, no PII collected)
if (import.meta.env.PROD) {
  const va = document.createElement('script');
  va.defer = true;
  va.src   = '/_vercel/insights/script.js';
  document.head.appendChild(va);
}

// Hide main content initially to prevent FOUC
document.getElementById('main-content')?.classList.add('visible');

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <I18nProvider>
      <ErrorBoundary
        FallbackComponent={ErrorFallback}
        onReset={() => window.location.reload()}
        onError={(error, info) => trackFrontendError(error, { componentStack: info?.componentStack })}
      >
        <App />
      </ErrorBoundary>
    </I18nProvider>
  </React.StrictMode>,
)

// Start observing Core Web Vitals (production only, non-blocking)
reportWebVitals();

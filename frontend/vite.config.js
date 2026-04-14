import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  esbuild: {
    drop: ['console', 'debugger'],
  },
  optimizeDeps: {
    include: [
      '@stripe/stripe-js',
      '@stripe/react-stripe-js',
    ],
  },
  server: {
    port: 5176,
    proxy: {
      '/api': {
        target: 'http://localhost:3005',
        changeOrigin: true,
        cookieDomainRewrite: 'localhost',
        configure: (proxy, options) => {
          proxy.on('proxyReq', (proxyReq, req, res) => {
            proxyReq.setHeader('origin', 'http://localhost:3005');
          });
        },
      },
    },
    headers: {
      'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://fonts.googleapis.com https://js.stripe.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://unpkg.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; media-src 'self' https://actions.google.com https://cdn.pixabay.com; connect-src 'self' http://localhost:* https://api.solocompass.app https://api.stripe.com; frame-src https://js.stripe.com https://hooks.stripe.com",
      'X-Frame-Options': 'DENY',
      'X-Content-Type-Options': 'nosniff',
    },
  },
  build: {
    sourcemap: false,
    cssCodeSplit: true,
    // Warn (and fail CI via rollup-plugin-visualizer) when any chunk exceeds 200 KB
    chunkSizeWarningLimit: 200,
    rollupOptions: {
      output: {
        // Manual chunking: split heavyweight vendor libs into separate async chunks
        // so each route-level chunk stays well below the 200 KB budget.
        manualChunks: {
          // React core
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          // State / data-fetching
          'vendor-query': ['@tanstack/react-query'],
          'vendor-zustand': ['zustand'],
          // Forms
          'vendor-forms': ['react-hook-form'],
          // UI / animation
          'vendor-framer': ['framer-motion'],
          'vendor-leaflet': ['leaflet', 'react-leaflet'],
          // Stripe
          'vendor-stripe': ['@stripe/stripe-js', '@stripe/react-stripe-js'],
          // Drag and drop
          'vendor-dnd': ['@dnd-kit/core', '@dnd-kit/sortable', '@dnd-kit/utilities'],
        },
      },
    },
  }
})

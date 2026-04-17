import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from backend directory
const envPath = path.join(__dirname, '../.env');
console.log('[Env] Loading from:', envPath);

if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    console.log('[Env] Loaded .env file successfully');
} else {
    console.error('[Env] .env not found at:', envPath);
}



// core: fetch secrets from Infisical BEFORE ANY OTHER IMPORTS
import initInfisical from './config/infisical.js';

async function bootstrap() {
  try {
    console.log('[Core] Phase 1: Initiating Infisical handshake...');
    try {
        await initInfisical();
    } catch (infError) {
        console.warn(`\x1b[33m[Infisical] Handshake failed: ${infError.message}\x1b[0m`);
        console.warn('\x1b[33m[Core] Falling back to local environment variables...\x1b[0m');
    }

    // Critical secret check before proceeding to heavy imports
    if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
        throw new Error('FATAL: JWT_SECRET is required but missing from both Infisical and local .env');
    }

    console.log('[Core] Phase 2: Injecting Mission-Critical Modules...');

    // dynamic imports ensure process.env is populated before these modules parse
    const { default: express } = await import('express');
    const { default: cors } = await import('cors');
    const { default: helmet } = await import('helmet');
    const { default: morgan } = await import('morgan');
    const { default: cookieParser } = await import('cookie-parser');
    const { default: rateLimit } = await import('express-rate-limit');
    const { default: passport } = await import('passport');
    const { createServer } = await import('http');
    
    const { configurePassport } = await import('./config/passport.js');
    const { default: db } = await import('./db.js');
    const { default: logger } = await import('./services/logger.js');
    const { initWebSocketServer } = await import('./services/websocket.js');
    const { startScheduledCheckInMonitor } = await import('./services/checkinMonitor.js');
    const { startEmailScheduler } = await import('./services/emailScheduler.js');
    const { generateSitemap } = await import('./services/sitemapService.js');

    // route imports
    const { default: authRoutes } = await import('./routes/auth.js');
    const { default: billingRoutes } = await import('./routes/billing.js');
    const { default: userRoutes } = await import('./routes/users.js');
    const { default: resourceRoutes } = await import('./routes/resources.js');
    const { default: categoryRoutes } = await import('./routes/categories.js');
    const { default: preferenceRoutes } = await import('./routes/preferences.js');
    const { default: quizRoutes } = await import('./routes/quiz.js');
    const { default: destinationRoutes } = await import('./routes/destinations.js');
    const { default: tripRoutes } = await import('./routes/trips.js');
    const { default: tripDocumentsRoutes } = await import('./routes/tripDocuments.js');
    const { default: accommodationsRoutes } = await import('./routes/accommodations.js');
    const { default: bookingsRoutes } = await import('./routes/bookings.js');
    const { default: tripPlacesRoutes } = await import('./routes/tripPlaces.js');
    const { default: advisoriesRoutes } = await import('./routes/advisories.js');
    const { default: reviewsRoutes } = await import('./routes/reviews.js');
    const { default: packingListsRoutes } = await import('./routes/packingLists.js');
    const { default: weatherRoutes } = await import('./routes/weather.js');
    const { default: exchangeRoutes } = await import('./routes/exchange.js');
    const { default: budgetRoutes } = await import('./routes/budget.js');
    const { default: flightRoutes } = await import('./routes/flights.js');
    const { default: currencyRoutes } = await import('./routes/currency.js');
    const { default: placesRoutes } = await import('./routes/places.js');
    const { default: directionsRoutes } = await import('./routes/directions.js');
    const { default: affiliateRoutes } = await import('./routes/affiliates.js');
    const { default: matchingRoutes } = await import('./routes/matching.js');
    const { default: messagesRoutes } = await import('./routes/messages.js');
    const { default: emergencyContactsRoutes } = await import('./routes/emergencyContacts.js');
    const { default: emergencyNumbersRoutes } = await import('./routes/emergencyNumbers.js');
    const { default: emergencyRoutes } = await import('./routes/emergency.js');
    const { default: smsWebhookRoutes } = await import('./routes/smsWebhook.js');
    const { default: checkinRoutes } = await import('./routes/checkin.js');
    const { default: analyticsRoutes } = await import('./routes/analytics.js');
    const { default: adminRoutes } = await import('./routes/admin.js');
    const { default: safetyRoutes } = await import('./routes/safety.js');
    const { default: aiRoutes } = await import('./routes/ai.js');
    const { default: translateRoutes } = await import('./routes/translate.js');
    const { default: helpRoutes } = await import('./routes/help.js');
    const { default: webhookRoutes } = await import('./routes/webhooks.js');
    const { default: notificationRoutes } = await import('./routes/notifications.js');
    const { default: verificationRoutes } = await import('./routes/verification.js');
const { default: countriesRoutes } = await import('./routes/countries.js');
    const { default: citiesRoutes } = await import('./routes/cities.js');
    const { default: errorRoutes } = await import('./routes/errors.js');
    const { default: checklistRoutes } = await import('./routes/checklist.js');
    const { default: guardianRoutes } = await import('./routes/guardian.js');
    const { default: callsRoutes } = await import('./routes/calls.js');
    const { default: esimRoutes } = await import('./routes/esim.js');
    const { default: twoFactorRoutes } = await import('./routes/twoFactor.js');
    const { default: onboardingRoutes } = await import('./routes/onboarding.js');

    const app = express();
    const server = createServer(app);
    const PORT = process.env.PORT || 3005;

    // app configuration
    app.disable('x-powered-by');
    
    // global rate limiter
    const isProd = process.env.NODE_ENV === 'production';
    app.use(rateLimit({ 
      windowMs: 15 * 60 * 1000, 
      max: isProd ? 100 : 10000, // Significantly increased for E2E/manual QA stabilization
      standardHeaders: true,
      legacyHeaders: false,
    }));
    
    app.use(express.json({ limit: '10kb' }));
    app.use(express.urlencoded({ extended: true, limit: '10kb' }));
    
    // cors
    const corsOrigins = process.env.NODE_ENV === 'production' 
        ? (process.env.FRONTEND_URL ? process.env.FRONTEND_URL.split(',') : false) 
        : true;
    app.use(cors({ origin: corsOrigins, credentials: true }));

    // security
    app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
    app.use(cookieParser());
    
    // passport
    configurePassport();
    app.use(passport.initialize());

    // HTTP logging (morgan)
    if (process.env.NODE_ENV !== 'test') {
      app.use(morgan('combined'));
    }

    // middleware: logging
    app.use((req, res, next) => {
        req.id = Math.random().toString(36).substring(2, 11);
        const start = Date.now();
        res.on('finish', () => {
            const ms = Date.now() - start;
            logger.info(`${req.method} ${req.url} ${res.statusCode} - ${ms}ms - (ID: ${req.id})`);
        });
        next();
    });

    // routes (applying core ones)
    app.use('/api/auth', authRoutes);
    app.use('/api/ai', aiRoutes);
    app.use('/api/trips', tripRoutes);
    app.use('/api/accommodations', accommodationsRoutes);
    app.use('/api/bookings', bookingsRoutes);
    app.use('/api/trip-documents', tripDocumentsRoutes);
    app.use('/api/trip-places', tripPlacesRoutes);
    app.use('/api/destinations', destinationRoutes);
    app.use('/api/users', userRoutes);
    app.use('/api/advisories', advisoriesRoutes);
    app.use('/api/checkin', checkinRoutes);
    app.use('/api/safety', safetyRoutes);
    app.use('/api/emergency-contacts', emergencyContactsRoutes);
    app.use('/api/emergency-numbers', emergencyNumbersRoutes);
    app.use('/api/emergency', emergencyRoutes);
    app.use('/api/billing', billingRoutes);
    app.use('/api/admin', adminRoutes);
    app.use('/api/analytics', analyticsRoutes);
    app.use('/api/notifications', notificationRoutes);
    app.use('/api/help', helpRoutes);
    app.use('/api/currency', currencyRoutes);
    app.use('/api/weather', weatherRoutes);
    app.use('/api/matching', matchingRoutes);
    app.use('/api/messages', messagesRoutes);
    app.use('/api/reviews', reviewsRoutes);
    app.use('/api/quiz', quizRoutes);
    app.use('/api/places', placesRoutes);
    app.use('/api/directions', directionsRoutes);
    app.use('/api/exchange', exchangeRoutes);
    app.use('/api/packing-lists', packingListsRoutes);
    app.use('/api/categories', categoryRoutes);
    app.use('/api/resources', resourceRoutes);
    app.use('/api/preferences', preferenceRoutes);
    app.use('/api/affiliates', affiliateRoutes);
    app.use('/api/flights', flightRoutes);
    app.use('/api/budget', budgetRoutes);
    app.use('/api/webhooks', webhookRoutes);
    app.use('/api/sms-webhook', smsWebhookRoutes);
    app.use('/api/verification', verificationRoutes);
    app.use('/api/errors', errorRoutes);
    app.use('/api/checklist', checklistRoutes);
    app.use('/api/guardian', guardianRoutes);
    app.use('/api/calls', callsRoutes);
    app.use('/api/esim', esimRoutes);
    app.use('/api/translate', translateRoutes);
    app.use('/api/countries', countriesRoutes);
    app.use('/api/cities', citiesRoutes);
    app.use('/api/users/me/2fa', twoFactorRoutes);
    app.use('/api/onboarding', onboardingRoutes);

    // Seed test events for admin (development only)
    if (process.env.NODE_ENV !== 'production') {
      try {
        const db = (await import('./db.js')).default;
        const userResult = await db.get('SELECT id FROM users LIMIT 1');
        const userId = userResult?.id || null;
        const now = new Date();

        const testEvents = [
          { event_name: 'trip_created', event_data: JSON.stringify({ tripId: 1, destination: 'Hong Kong' }), hoursAgo: 1 },
          { event_name: 'trip_created', event_data: JSON.stringify({ tripId: 2, destination: 'Tokyo' }), hoursAgo: 24 },
          { event_name: 'checkin_completed', event_data: JSON.stringify({ checkinId: 1, status: 'safe' }), hoursAgo: 2 },
          { event_name: 'checkin_missed', event_data: JSON.stringify({ checkinId: 2, status: 'missed' }), hoursAgo: 48 },
          { event_name: 'sos_triggered', event_data: JSON.stringify({ tripId: 1, reason: 'missed_checkins' }), hoursAgo: 72 },
          { event_name: 'user_registered', event_data: JSON.stringify({ method: 'email' }), hoursAgo: 120 },
          { event_name: 'ai_chat_message', event_data: JSON.stringify({ model: 'gpt-4o', tokens: 150 }), hoursAgo: 3 },
          { event_name: 'advisory_notification', event_data: JSON.stringify({ country: 'Hong Kong', level: 'caution' }), hoursAgo: 24 },
          { event_name: 'trip_completed', event_data: JSON.stringify({ tripId: 3, destination: 'Paris' }), hoursAgo: 168 },
          { event_name: 'itinerary_generated', event_data: JSON.stringify({ tripId: 1, days: 5 }), hoursAgo: 5 },
          { event_name: 'client_error', event_data: JSON.stringify({ message: 'TypeError: Cannot read properties of undefined', stack: 'at TripCard.jsx:45', url: 'http://localhost:5176/trips', userAgent: 'Mozilla/5.0', timestamp: new Date(now - 2 * 3600000).toISOString(), type: 'uncaught_exception' }), hoursAgo: 2 },
          { event_name: 'client_error', event_data: JSON.stringify({ message: 'Failed to fetch destinations', stack: 'at api.js:12', url: 'http://localhost:5176/destinations', userAgent: 'Mozilla/5.0', timestamp: new Date(now - 5 * 3600000).toISOString(), type: 'unhandled_rejection' }), hoursAgo: 5 },
          { event_name: 'client_error', event_data: JSON.stringify({ message: 'NetworkError when attempting to fetch resource', stack: '', url: 'http://localhost:5176/dashboard', userAgent: 'Mozilla/5.0', timestamp: new Date(now - 24 * 3600000).toISOString(), type: 'resource_error' }), hoursAgo: 24 },
          { event_name: 'client_error', event_data: JSON.stringify({ message: 'ReferenceError: useState is not defined', stack: 'at Layout.jsx:9', url: 'http://localhost:5176/admin', userAgent: 'Mozilla/5.0', timestamp: new Date(now - 3 * 24 * 3600000).toISOString(), type: 'uncaught_exception' }), hoursAgo: 72 },
          { event_name: 'client_error', event_data: JSON.stringify({ message: '404 Not Found: /api/trips/999', stack: '', url: 'http://localhost:5176/trips/999', userAgent: 'Mozilla/5.0', timestamp: new Date(now - 5 * 24 * 3600000).toISOString(), type: 'unhandled_rejection' }), hoursAgo: 120 },
        ];

        const existingCount = await db.get('SELECT COUNT(*) as count FROM events');
        if ((existingCount?.count || 0) < 5) {
          for (const event of testEvents) {
            const timestamp = new Date(now - event.hoursAgo * 3600000);
            await db.run(
              `INSERT INTO events (user_id, event_name, event_data, timestamp) VALUES (?, ?, ?, ?)`,
              userId, event.event_name, event.event_data, timestamp.toISOString()
            );
          }
          logger.info(`[Seed] Inserted ${testEvents.length} test events`);
        } else {
          logger.info('[Seed] Events already exist, skipping seed');
        }
      } catch (seedErr) {
        logger.error(`[Seed] Failed: ${seedErr.message}`);
      }
    }

    // health - generic status only
    app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

    // 404 handler for unknown API routes
    app.use('/api', (req, res) => {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'API endpoint not found' } });
    });

    // global error handler
    app.use((err, req, res, next) => {
        logger.error(`[Error] ${req.id} - ${err.message}\n${err.stack}`);
        res.status(err.status || 500).json({ success: false, error: { message: 'Something went wrong', requestId: req.id } });
    });

      server.listen(PORT, () => {
        console.log(`\x1b[32m SoloCompass Core Online :: Listening on Port ${PORT} \x1b[0m`);
        initWebSocketServer(server);
        startScheduledCheckInMonitor();
        startEmailScheduler();
        generateSitemap().catch(err => logger.error(`[SEO] Sitemap fail: ${err.message}`));
        
        // Automated Production Seeding (Phase 5) - Development only
        if (process.env.NODE_ENV !== 'production') {
          const triggerSeed = async () => {
            try {
              const { count } = await db.prepare('SELECT COUNT(*) as count FROM destinations').get();
              if (count < 10) {
                logger.info(`[SEED] Low data detected (${count}). Triggering automated research...`);
                const { researchDestination } = await import('./services/researchService.js');
                const TOP_20 = [
                  'Tokyo, Japan', 'Reykjavik, Iceland', 'Kyoto, Japan', 'Rhodes, Greece',
                  'Chiang Mai, Thailand', 'Porto, Portugal', 'Copenhagen, Denmark', 'Hanoi, Vietnam',
                  'Split, Croatia', 'Ljubljana, Slovenia', 'Verona, Italy', 'Ghent, Belgium'
                ];
                for (const city of TOP_20) {
                  // Fire and forget individual research tasks to avoid blocking
                  researchDestination(city).catch(e => logger.error(`[SEED] Child process fail for ${city}: ${e.message}`));
                }
              }
            } catch (e) {
              logger.warn(`[SEED] Routine check failed: ${e.message}`);
            }
          };
          triggerSeed();
        }
      });

  } catch (error) {
    console.error('\n\x1b[31m[FATAL] Mission Failure during boot - verify Infisical Connection!\x1b[0m');
    console.error(error);
    process.exit(1);
  }
}

bootstrap();

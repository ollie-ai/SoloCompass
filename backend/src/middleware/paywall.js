import db from '../db.js';
import logger from '../services/logger.js';

/**
 * Plan tiers with feature access levels
 */
export const PLAN_TIERS = {
  EXPLORER: 'explorer',
  GUARDIAN: 'guardian',
  NAVIGATOR: 'navigator'
};

/**
 * Feature flags for granular access control
 */
export const FEATURES = {
  // Planning
  ADVENTURE_DNA: 'adventure_dna',
  CREATE_TRIPS: 'create_trips',
  ITINERARY_TIMELINE: 'itinerary_timeline',
  ACTIVITY_CRUD: 'activity_crud',
  AI_ITINERARY: 'ai_itinerary',
  PDF_EXPORT: 'pdf_export',

  // Safety
  MANUAL_CHECKIN: 'manual_checkin',
  SCHEDULED_CHECKIN: 'scheduled_checkin',
  MISSED_CHECKIN_ESCALATION: 'missed_checkin_escalation',
  EMERGENCY_CONTACTS: 'emergency_contacts',
  SOS_BUTTON: 'sos_button',
  SAFE_RETURN_TIMER: 'safe_return_timer',
  SAFE_HAVEN_LOCATOR: 'safe_haven_locator',
  ADVISORIES: 'advisories',

  // Trip Tools
  PACKING_LIST: 'packing_list',
  BUDGET_TRACKER: 'budget_tracker',
  CURRENCY_CONVERTER: 'currency_converter',
  WEATHER_WIDGET: 'weather_widget',
  PLACES_SEARCH: 'places_search',
  FLIGHT_STATUS: 'flight_status',

  // AI
  AI_CHAT: 'ai_chat',
  AI_DESTINATION_GUIDE: 'ai_destination_guide',
  AI_SAFETY_ADVICE: 'ai_safety_advice',
  QUICK_TRANSLATOR: 'quick_translator',

  // Community
  BUDDY_DISCOVERY: 'buddy_discovery',
  CONNECTIONS: 'connections',

  // Data
  EXPORT_DATA: 'export_data',
  DELETE_DATA: 'delete_data'
};

/**
 * Feature access matrix
 */
const PLAN_ACCESS = {
  [PLAN_TIERS.EXPLORER]: [
    FEATURES.ADVENTURE_DNA,
    FEATURES.CREATE_TRIPS,
    FEATURES.ITINERARY_TIMELINE,
    FEATURES.ACTIVITY_CRUD,
    FEATURES.AI_ITINERARY, // 1 per month
    FEATURES.MANUAL_CHECKIN,
    FEATURES.SOS_BUTTON,
    FEATURES.ADVISORIES,
    FEATURES.PACKING_LIST,
    FEATURES.BUDGET_TRACKER,
    FEATURES.CURRENCY_CONVERTER,
    FEATURES.WEATHER_WIDGET,
    FEATURES.PLACES_SEARCH,
    FEATURES.FLIGHT_STATUS,
    FEATURES.EXPORT_DATA,
    FEATURES.DELETE_DATA
  ],
  [PLAN_TIERS.GUARDIAN]: [
    FEATURES.ADVENTURE_DNA,
    FEATURES.CREATE_TRIPS,
    FEATURES.ITINERARY_TIMELINE,
    FEATURES.ACTIVITY_CRUD,
    FEATURES.AI_ITINERARY, // unlimited
    FEATURES.PDF_EXPORT,
    FEATURES.MANUAL_CHECKIN,
    FEATURES.SCHEDULED_CHECKIN,
    FEATURES.MISSED_CHECKIN_ESCALATION,
    FEATURES.EMERGENCY_CONTACTS,
    FEATURES.SOS_BUTTON,
    FEATURES.SAFE_RETURN_TIMER,
    FEATURES.SAFE_HAVEN_LOCATOR,
    FEATURES.ADVISORIES,
    FEATURES.PACKING_LIST,
    FEATURES.BUDGET_TRACKER,
    FEATURES.CURRENCY_CONVERTER,
    FEATURES.WEATHER_WIDGET,
    FEATURES.PLACES_SEARCH,
    FEATURES.FLIGHT_STATUS,
    FEATURES.EXPORT_DATA,
    FEATURES.DELETE_DATA
  ],
  [PLAN_TIERS.NAVIGATOR]: [
    FEATURES.ADVENTURE_DNA,
    FEATURES.CREATE_TRIPS,
    FEATURES.ITINERARY_TIMELINE,
    FEATURES.ACTIVITY_CRUD,
    FEATURES.AI_ITINERARY,
    FEATURES.PDF_EXPORT,
    FEATURES.MANUAL_CHECKIN,
    FEATURES.SCHEDULED_CHECKIN,
    FEATURES.MISSED_CHECKIN_ESCALATION,
    FEATURES.EMERGENCY_CONTACTS,
    FEATURES.SOS_BUTTON,
    FEATURES.SAFE_RETURN_TIMER,
    FEATURES.SAFE_HAVEN_LOCATOR,
    FEATURES.ADVISORIES,
    FEATURES.PACKING_LIST,
    FEATURES.BUDGET_TRACKER,
    FEATURES.CURRENCY_CONVERTER,
    FEATURES.WEATHER_WIDGET,
    FEATURES.PLACES_SEARCH,
    FEATURES.FLIGHT_STATUS,
    FEATURES.AI_CHAT,
    FEATURES.AI_DESTINATION_GUIDE,
    FEATURES.AI_SAFETY_ADVICE,
    FEATURES.QUICK_TRANSLATOR,
    FEATURES.BUDDY_DISCOVERY,
    FEATURES.CONNECTIONS,
    FEATURES.EXPORT_DATA,
    FEATURES.DELETE_DATA
  ]
};

/**
 * Get user's plan tier from database
 */
const getUserPlan = async (userId) => {
  const user = await db.prepare('SELECT subscription_tier, is_premium FROM users WHERE id = ?').get(userId);
  if (!user) return PLAN_TIERS.EXPLORER;
  
  // Legacy: treat premium users as Guardian
  if (user.is_premium && !user.subscription_tier) {
    return PLAN_TIERS.GUARDIAN;
  }
  
  return user.subscription_tier || PLAN_TIERS.EXPLORER;
};

/**
 * Check if user has access to a specific feature
 */
export const hasFeature = async (userId, feature) => {
  const plan = await getUserPlan(userId);
  const accessList = PLAN_ACCESS[plan] || PLAN_ACCESS[PLAN_TIERS.EXPLORER];
  return accessList.includes(feature);
};

/**
 * Middleware to check if user has access to a specific feature
 */
export const requireFeature = (feature) => {
  return async (req, res, next) => {
    try {
      const plan = await getUserPlan(req.userId);
      const hasAccess = await hasFeature(req.userId, feature);

      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'FEATURE_NOT_INCLUDED',
            message: `This feature requires the ${plan === PLAN_TIERS.GUARDIAN ? 'Guardian' : plan === PLAN_TIERS.NAVIGATOR ? 'Navigator' : 'Explorer'} plan.`,
            currentPlan: plan,
            upgradeUrl: '/settings?tab=billing'
          }
        });
      }

      next();
    } catch (error) {
      logger.error('Feature check middleware error:', error);
      next(); // Allow on error to avoid blocking users
    }
  };
};

/**
 * Middleware to restrict access to premium-only features
 * Legacy compatibility - treats premium as Guardian
 */
export const premiumOnly = async (req, res, next) => {
  try {
    const user = await db.prepare('SELECT is_premium, role, subscription_tier FROM users WHERE id = ?').get(req.userId);
    
    // Admins always have access
    if (user?.role === 'admin') {
      return next();
    }

    // Check if premium or Guardian/Navigator
    const isPremium = user?.is_premium || 
                      user?.subscription_tier === PLAN_TIERS.GUARDIAN || 
                      user?.subscription_tier === PLAN_TIERS.NAVIGATOR;

    if (!isPremium) {
      // Check if it's an itinerary generation request to allow 1 free use
      // Supports both /api/ai/generate-itinerary and /api/trips/:id/generate
      if (req.path.includes('/generate-itinerary') || req.path.match(/\/trips\/\d+\/generate$/)) {
        const tripCount = await db.prepare(
          'SELECT COUNT(*) as count FROM trips WHERE user_id = ? AND generation_status = ?'
        ).get(req.userId, 'completed');
        
        if (tripCount?.count < 1) {
          return next(); // Allow first generation for free
        }
      }

      return res.status(402).json({
        success: false,
        error: {
          code: 'PREMIUM_REQUIRED',
          message: 'This feature requires SoloCompass Guardian or Navigator.',
          upgradeUrl: '/settings?tab=billing'
        }
      });
    }

    next();
  } catch (error) {
    logger.error('Paywall middleware error:', error);
    next();
  }
};

/**
 * Middleware to enforce trip limits per plan
 */
export const enforceTripLimits = async (req, res, next) => {
  try {
    const user = await db.prepare('SELECT subscription_tier, is_premium FROM users WHERE id = ?').get(req.userId);
    const plan = user?.subscription_tier || PLAN_TIERS.EXPLORER;
    
    // Count active trips (not cancelled)
    const activeTrips = await db.prepare(
      'SELECT COUNT(*) as count FROM trips WHERE user_id = ? AND status != ?'
    ).get(req.userId, 'cancelled');

    // Explorer limited to 2 active trips
    if (plan === PLAN_TIERS.EXPLORER && activeTrips?.count >= 2) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'TRIP_LIMIT_REACHED',
          message: 'Explorer plan limited to 2 active trips. Upgrade to Guardian for unlimited.',
          upgradeUrl: '/settings?tab=billing'
        }
      });
    }

    next();
  } catch (error) {
    logger.error('Trip limits middleware error:', error);
    next();
  }
};

/**
 * Middleware to check AI usage limits
 */
export const checkAILimits = async (req, res, next) => {
  try {
    const user = await db.prepare('SELECT subscription_tier, is_premium FROM users WHERE id = ?').get(req.userId);
    const plan = user?.subscription_tier || PLAN_TIERS.EXPLORER;
    
    // Navigator has unlimited
    if (plan === PLAN_TIERS.NAVIGATOR) {
      return next();
    }

    // Guardian has unlimited
    if (plan === PLAN_TIERS.GUARDIAN || user?.is_premium) {
      return next();
    }

    // Explorer - check limits: 1 itinerary/month, 10 chat messages/day
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
    const currentDay   = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

    // Determine what type of AI request this is based on route
    const isChatRequest = req.path === '/chat';
    const isItineraryRequest = req.path === '/generate-itinerary';

    if (isItineraryRequest) {
      const itineraryUsage = await db.prepare(
        'SELECT COUNT(*) as count FROM ai_usage WHERE user_id = ? AND month = ? AND type = ?'
      ).get(req.userId, currentMonth, 'itinerary');

      if (itineraryUsage?.count >= 1) {
        return res.status(429).json({
          success: false,
          error: {
            code: 'AI_LIMIT_REACHED',
            message: 'Explorer plan includes 1 AI itinerary per month. Your limit resets next month.',
            upgradeUrl: '/settings?tab=billing',
            nextReset: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toISOString()
          }
        });
      }
    }

    if (isChatRequest) {
      // Spec: 10 messages per day for Explorer plan
      const chatUsage = await db.prepare(
        'SELECT COUNT(*) as count FROM ai_usage WHERE user_id = ? AND day = ? AND type = ?'
      ).get(req.userId, currentDay, 'chat');

      if (chatUsage?.count >= 10) {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);
        return res.status(429).json({
          success: false,
          error: {
            code: 'AI_LIMIT_REACHED',
            message: 'Explorer plan includes 10 AI chat messages per day. Your limit resets tomorrow.',
            upgradeUrl: '/settings?tab=billing',
            nextReset: tomorrow.toISOString()
          }
        });
      }
    }

    // Track usage — insert or increment, keyed by both month and day
    const usageType = isChatRequest ? 'chat' : (isItineraryRequest ? 'itinerary' : 'other');
    if (usageType !== 'other') {
      await db.prepare(
        `INSERT INTO ai_usage (user_id, month, day, type, count)
         VALUES (?, ?, ?, ?, 1)
         ON CONFLICT(user_id, month, type) DO UPDATE SET count = count + 1, day = excluded.day`
      ).run(req.userId, currentMonth, currentDay, usageType);
    }

    next();
  } catch (error) {
    logger.error('AI limits middleware error:', error);
    next(); // Allow on error
  }
};

export default {
  PLAN_TIERS,
  FEATURES,
  hasFeature,
  requireFeature,
  premiumOnly,
  enforceTripLimits,
  checkAILimits
};

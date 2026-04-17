/**
 * Notification Type Registry
 * Defines all notification types, their metadata, and routing rules
 */

export const PRIORITY = {
  P0_EMERGENCY: 'P0',
  P1_URGENT: 'P1',
  P2_IMPORTANT: 'P2',
  P3_INFO: 'P3',
};

export const CHANNEL = {
  IN_APP: 'in_app',
  EMAIL: 'email',
  PUSH: 'push',
  SMS: 'sms',
  OPS: 'ops',
};

export const CONTROL_LEVEL = {
  LOCKED: 'locked',
  USER_CONTROLLED: 'user_controlled',
  SYSTEM_MANAGED: 'system_managed',
};

export const DELIVERY_STATUS = {
  QUEUED: 'queued',
  SENT: 'sent',
  DELIVERED: 'delivered',
  FAILED: 'failed',
  PENDING_RETRY: 'pending_retry',
};

/**
 * Notification type definitions
 * Maps notification types to their routing rules and preferences
 */
export const NOTIFICATION_TYPES = {
  // === SAFETY & EMERGENCY ===
  checkin_reminder: {
    name: 'Check-in Reminder',
    description: 'Reminder before a scheduled check-in is due',
    priority: PRIORITY.P1_URGENT,
    channels: [CHANNEL.IN_APP, CHANNEL.PUSH],
    controlLevel: CONTROL_LEVEL.USER_CONTROLLED,
    preferenceKey: 'checkinReminders',
    lockedForActiveSafety: true,
  },
  checkin_missed: {
    name: 'Missed Check-in Warning',
    description: 'Alert sent when a scheduled check-in is missed',
    priority: PRIORITY.P1_URGENT,
    channels: [CHANNEL.IN_APP, CHANNEL.PUSH, CHANNEL.SMS],
    controlLevel: CONTROL_LEVEL.USER_CONTROLLED,
    preferenceKey: 'checkinMissed',
    lockedForActiveSafety: true,
    smsOnlyIfEnabled: true,
  },
  checkin_confirmed: {
    name: 'Check-in Confirmed',
    description: 'Manual check-in confirmation',
    priority: PRIORITY.P3_INFO,
    channels: [CHANNEL.IN_APP],
    controlLevel: CONTROL_LEVEL.SYSTEM_MANAGED,
  },
  safe_checkin_sent: {
    name: 'Safe Check-in Sent',
    description: 'Safe check-in sent to emergency contact',
    priority: PRIORITY.P1_URGENT,
    channels: [CHANNEL.EMAIL, CHANNEL.SMS],
    controlLevel: CONTROL_LEVEL.SYSTEM_MANAGED,
    forEmergencyContact: true,
  },
  sos_triggered: {
    name: 'SOS Triggered',
    description: 'Confirmation when SOS is triggered',
    priority: PRIORITY.P0_EMERGENCY,
    channels: [CHANNEL.IN_APP, CHANNEL.PUSH],
    controlLevel: CONTROL_LEVEL.LOCKED,
    preferenceKey: 'checkinEmergency',
  },
  sos_alert: {
    name: 'SOS Alert',
    description: 'SOS alert sent to emergency contacts',
    priority: PRIORITY.P0_EMERGENCY,
    channels: [CHANNEL.EMAIL, CHANNEL.SMS],
    controlLevel: CONTROL_LEVEL.LOCKED,
    forEmergencyContact: true,
  },
  sos_acknowledged: {
    name: 'SOS Acknowledged',
    description: 'Guardian acknowledged your SOS alert',
    priority: PRIORITY.P0_EMERGENCY,
    channels: [CHANNEL.IN_APP, CHANNEL.PUSH],
    controlLevel: CONTROL_LEVEL.LOCKED,
  },
  safe_return_overdue: {
    name: 'Safe Return Overdue',
    description: 'Safe return timer has expired',
    priority: PRIORITY.P0_EMERGENCY,
    channels: [CHANNEL.IN_APP, CHANNEL.PUSH, CHANNEL.SMS],
    controlLevel: CONTROL_LEVEL.LOCKED,
    forEmergencyContact: true,
    smsOnlyIfEnabled: true,
  },
  safety_advisory: {
    name: 'Safety Advisory',
    description: 'Safety advisory affecting active trip',
    priority: PRIORITY.P1_URGENT,
    channels: [CHANNEL.IN_APP, CHANNEL.EMAIL, CHANNEL.PUSH],
    controlLevel: CONTROL_LEVEL.USER_CONTROLLED,
    preferenceKey: 'tripReminders',
  },

  // === TRIP NOTIFICATIONS ===
  trip_reminder: {
    name: 'Trip Reminder',
    description: 'Upcoming trip reminder',
    priority: PRIORITY.P2_IMPORTANT,
    channels: [CHANNEL.IN_APP, CHANNEL.EMAIL, CHANNEL.PUSH],
    controlLevel: CONTROL_LEVEL.USER_CONTROLLED,
    preferenceKey: 'tripReminders',
  },
  itinerary_ready: {
    name: 'AI Itinerary Ready',
    description: 'AI-generated itinerary is ready',
    priority: PRIORITY.P2_IMPORTANT,
    channels: [CHANNEL.IN_APP, CHANNEL.EMAIL],
    controlLevel: CONTROL_LEVEL.USER_CONTROLLED,
    preferenceKey: 'tripReminders',
  },
  itinerary_failed: {
    name: 'AI Itinerary Failed',
    description: 'AI itinerary generation failed',
    priority: PRIORITY.P1_URGENT,
    channels: [CHANNEL.IN_APP, CHANNEL.PUSH],
    controlLevel: CONTROL_LEVEL.SYSTEM_MANAGED,
  },
  booking_change: {
    name: 'Booking/Itinerary Change',
    description: 'Booking or itinerary change notification',
    priority: PRIORITY.P1_URGENT,
    channels: [CHANNEL.IN_APP, CHANNEL.EMAIL, CHANNEL.PUSH],
    controlLevel: CONTROL_LEVEL.USER_CONTROLLED,
    preferenceKey: 'tripReminders',
  },
  budget_alert: {
    name: 'Budget Alert',
    description: 'Budget threshold crossed',
    priority: PRIORITY.P2_IMPORTANT,
    channels: [CHANNEL.IN_APP, CHANNEL.PUSH],
    controlLevel: CONTROL_LEVEL.USER_CONTROLLED,
    preferenceKey: 'budgetAlerts',
  },
  document_expiry: {
    name: 'Document Expiry Warning',
    description: 'Travel document expiry warning',
    priority: PRIORITY.P1_URGENT,
    channels: [CHANNEL.IN_APP, CHANNEL.EMAIL],
    controlLevel: CONTROL_LEVEL.SYSTEM_MANAGED,
  },

  // === COMMUNITY ===
  buddy_request: {
    name: 'Buddy Request',
    description: 'New buddy request received',
    priority: PRIORITY.P2_IMPORTANT,
    channels: [CHANNEL.IN_APP, CHANNEL.PUSH],
    controlLevel: CONTROL_LEVEL.USER_CONTROLLED,
    preferenceKey: 'buddyRequests',
  },
  buddy_accepted: {
    name: 'Buddy Request Accepted',
    description: 'Buddy request was accepted',
    priority: PRIORITY.P2_IMPORTANT,
    channels: [CHANNEL.IN_APP, CHANNEL.PUSH],
    controlLevel: CONTROL_LEVEL.USER_CONTROLLED,
    preferenceKey: 'buddyRequests',
  },
  buddy_declined: {
    name: 'Buddy Request Declined',
    description: 'Buddy request was declined',
    priority: PRIORITY.P3_INFO,
    channels: [CHANNEL.IN_APP],
    controlLevel: CONTROL_LEVEL.USER_CONTROLLED,
    preferenceKey: 'buddyRequests',
  },

  // === ACCOUNT & BILLING ===
  welcome: {
    name: 'Welcome',
    description: 'Welcome / account created',
    priority: PRIORITY.P2_IMPORTANT,
    channels: [CHANNEL.EMAIL],
    controlLevel: CONTROL_LEVEL.SYSTEM_MANAGED,
  },
  password_reset: {
    name: 'Password Reset',
    description: 'Password reset email',
    priority: PRIORITY.P1_URGENT,
    channels: [CHANNEL.EMAIL],
    controlLevel: CONTROL_LEVEL.SYSTEM_MANAGED,
  },
  email_verification: {
    name: 'Email Verification',
    description: 'Email verification email',
    priority: PRIORITY.P1_URGENT,
    channels: [CHANNEL.EMAIL],
    controlLevel: CONTROL_LEVEL.SYSTEM_MANAGED,
  },
  subscription_upgraded: {
    name: 'Subscription Upgraded',
    description: 'Subscription upgrade confirmation',
    priority: PRIORITY.P2_IMPORTANT,
    channels: [CHANNEL.EMAIL, CHANNEL.IN_APP],
    controlLevel: CONTROL_LEVEL.SYSTEM_MANAGED,
  },
  payment_failed: {
    name: 'Payment Failed',
    description: 'Payment failure notification',
    priority: PRIORITY.P1_URGENT,
    channels: [CHANNEL.EMAIL, CHANNEL.IN_APP],
    controlLevel: CONTROL_LEVEL.SYSTEM_MANAGED,
  },
  subscription_cancelled: {
    name: 'Subscription Cancelled',
    description: 'Subscription cancelled or ending',
    priority: PRIORITY.P2_IMPORTANT,
    channels: [CHANNEL.EMAIL, CHANNEL.IN_APP],
    controlLevel: CONTROL_LEVEL.SYSTEM_MANAGED,
  },
  payment_success: {
    name: 'Payment Successful',
    description: 'Payment processed successfully',
    priority: PRIORITY.P2_IMPORTANT,
    channels: [CHANNEL.EMAIL, CHANNEL.IN_APP],
    controlLevel: CONTROL_LEVEL.SYSTEM_MANAGED,
  },
  usage_warning: {
    name: 'Usage Warning',
    description: 'Approaching usage limit',
    priority: PRIORITY.P2_IMPORTANT,
    channels: [CHANNEL.IN_APP, CHANNEL.PUSH],
    controlLevel: CONTROL_LEVEL.USER_CONTROLLED,
    preferenceKey: 'budgetAlerts',
  },
  trial_ending: {
    name: 'Trial Ending Soon',
    description: 'Free trial ending reminder',
    priority: PRIORITY.P2_IMPORTANT,
    channels: [CHANNEL.EMAIL, CHANNEL.IN_APP, CHANNEL.PUSH],
    controlLevel: CONTROL_LEVEL.SYSTEM_MANAGED,
  },
  trial_expired: {
    name: 'Trial Expired',
    description: 'Free trial has expired',
    priority: PRIORITY.P2_IMPORTANT,
    channels: [CHANNEL.EMAIL, CHANNEL.IN_APP],
    controlLevel: CONTROL_LEVEL.SYSTEM_MANAGED,
  },

  // === MARKETING & DIGEST (P3) ===
  marketing_promotion: {
    name: 'Promotion',
    description: 'Promotional offers and deals (weekly digest, unsubscribable)',
    priority: PRIORITY.P3_INFO,
    channels: [CHANNEL.EMAIL],
    controlLevel: CONTROL_LEVEL.USER_CONTROLLED,
    preferenceKey: 'marketingNotifications',
    batchable: true,
    digestFrequency: 'weekly',
  },
  content_tip: {
    name: 'Tips & Content',
    description: 'Travel tips, content updates, and recommendations (daily digest)',
    priority: PRIORITY.P3_INFO,
    channels: [CHANNEL.EMAIL, CHANNEL.IN_APP],
    controlLevel: CONTROL_LEVEL.USER_CONTROLLED,
    preferenceKey: 'marketingNotifications',
    batchable: true,
    digestFrequency: 'daily',
  },
};

export const OPS_ALERT_TYPES = {
  DELIVERY_FAILURE: 'delivery_failure',
  PROVIDER_OUTAGE: 'provider_outage',
  RETRY_EXHAUSTED: 'retry_exhausted',
};

export const OPS_SEVERITY = {
  CRITICAL: 'critical',
  WARNING: 'warning',
  INFO: 'info',
};

/**
 * Get channels for a notification type based on user preferences
 */
export function getChannelsForType(notificationType, preferences) {
  const typeDef = NOTIFICATION_TYPES[notificationType];
  if (!typeDef) return [];

  const { channels, preferenceKey, smsOnlyIfEnabled } = typeDef;

  if (typeDef.controlLevel === CONTROL_LEVEL.LOCKED) {
    return channels;
  }

  if (typeDef.controlLevel === CONTROL_LEVEL.SYSTEM_MANAGED) {
    return channels;
  }

  const enabledChannels = [];

  for (const channel of channels) {
    if (channel === CHANNEL.EMAIL && preferences.emailNotifications !== false) {
      enabledChannels.push(channel);
    } else if (channel === CHANNEL.PUSH && preferences.pushNotifications !== false) {
      enabledChannels.push(channel);
    } else if (channel === CHANNEL.SMS) {
      if (smsOnlyIfEnabled && preferences.smsNotifications !== true) {
        continue;
      }
      enabledChannels.push(channel);
    } else if (channel === CHANNEL.IN_APP) {
      enabledChannels.push(channel);
    }
  }

  if (preferenceKey && preferences[preferenceKey] === false) {
    return enabledChannels.filter(c => c === CHANNEL.IN_APP);
  }

  return enabledChannels;
}

/**
 * Get priority label for display
 */
export function getPriorityLabel(priority) {
  const labels = {
    [PRIORITY.P0_EMERGENCY]: { short: 'P0', label: 'Emergency', color: 'error' },
    [PRIORITY.P1_URGENT]: { short: 'P1', label: 'Urgent', color: 'warning' },
    [PRIORITY.P2_IMPORTANT]: { short: 'P2', label: 'Important', color: 'primary' },
    [PRIORITY.P3_INFO]: { short: 'P3', label: 'Info', color: 'neutral' },
  };
  return labels[priority] || labels[PRIORITY.P3_INFO];
}

/**
 * Check if notification type can be disabled
 */
export function canBeDisabled(notificationType) {
  const typeDef = NOTIFICATION_TYPES[notificationType];
  return typeDef?.controlLevel === CONTROL_LEVEL.USER_CONTROLLED;
}

/**
 * Check if notification type is safety-critical (cannot be fully disabled)
 */
export function isSafetyCritical(notificationType) {
  const typeDef = NOTIFICATION_TYPES[notificationType];
  return typeDef?.priority === PRIORITY.P0_EMERGENCY || typeDef?.priority === PRIORITY.P1_URGENT;
}

export default {
  PRIORITY,
  CHANNEL,
  CONTROL_LEVEL,
  DELIVERY_STATUS,
  NOTIFICATION_TYPES,
  OPS_ALERT_TYPES,
  OPS_SEVERITY,
  getChannelsForType,
  getPriorityLabel,
  canBeDisabled,
  isSafetyCritical,
};

import dotenv from 'dotenv';
import { 
  sendWelcomeEmail as sendWelcomeEmailInternal, 
  sendPasswordResetEmail as sendPasswordResetEmailInternal, 
  sendVerificationEmail as sendVerificationEmailInternal,
  sendTripConfirmation,
  sendSafetyCheckIn,
  sendEmergencyAlert,
  sendWeeklyDigest,
  sendTemplateEmail,
  getTemplatesInfo,
  previewTemplate,
  FROM_EMAIL
} from './resendClient.js';

dotenv.config();

export const sendWelcomeEmail = async (email, name) => {
  return sendWelcomeEmailInternal(email, {
    name,
    dashboardUrl: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/dashboard`
  });
};

export const sendVerificationEmail = async (email, token) => {
  const apiBase = process.env.BACKEND_URL || 'http://localhost:3001';
  const verifyUrl = `${apiBase}/api/auth/verify?token=${token}`;
  return sendVerificationEmailInternal(email, { verifyUrl });
};

export const sendPasswordResetEmail = async (email, token) => {
  const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${token}`;
  return sendPasswordResetEmailInternal(email, { resetUrl });
};

export const sendTripConfirmed = async (email, tripData) => {
  const { name, tripName, destination, startDate, endDate, itinerary } = tripData;
  const tripUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/trips/${tripData.tripId || ''}`;
  return sendTripConfirmation(email, {
    name,
    tripName,
    destination,
    startDate,
    endDate,
    tripUrl,
    itinerary
  });
};

export const sendSafetyCheckInNotification = async (emergencyContactEmail, data) => {
  const { travelerName, tripName, destination, emergencyContactName } = data;
  const checkInUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/safety-checkin`;
  return sendSafetyCheckIn(emergencyContactEmail, {
    travelerName,
    tripName,
    destination,
    checkInUrl,
    emergencyContactName
  });
};

export const sendEmergency = async (emergencyContactEmail, data) => {
  const { travelerName, tripName, destination, emergencyContactName, contactPhone, message } = data;
  return sendEmergencyAlert(emergencyContactEmail, {
    travelerName,
    tripName,
    destination,
    emergencyContactName,
    contactPhone,
    message
  });
};

export const sendDigest = async (email, data) => {
  const { name, upcomingTrips, recentReviews, tripSuggestions } = data;
  const dashboardUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/dashboard`;
  return sendWeeklyDigest(email, {
    name,
    upcomingTrips,
    recentReviews,
    tripSuggestions,
    dashboardUrl
  });
};

export const sendCustomEmail = async (email, templateType, vars) => {
  return sendTemplateEmail(email, templateType, vars);
};

export const getEmailTemplates = () => getTemplatesInfo();

export const previewEmail = (type, format = 'html') => previewTemplate(type, format);

export const sendTestEmail = async (email, templateType = 'welcome') => {
  return sendTemplateEmail(email, templateType, { name: 'Test User', dashboardUrl: '#' });
};

export const sendMagicLinkEmail = async (email, magicLinkUrl, name) => {
  const { sendEmail } = await import('./resendClient.js');
  return sendEmail({
    to: email,
    subject: 'Your SoloCompass Magic Link',
    html: `<p>Hi ${name},</p><p>Click the link below to sign in to SoloCompass. This link expires in 15 minutes.</p><p><a href="${magicLinkUrl}" style="display:inline-block;padding:12px 24px;background:#6366f1;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;">Sign In with Magic Link</a></p><p>If you didn't request this, you can safely ignore this email.</p>`,
  });
};

export { FROM_EMAIL };

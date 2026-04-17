import db from '../db.js';
import logger from './logger.js';
import { renderTemplate } from './emailTemplates.js';
import { sendEmail } from './resendClient.js';

const DEFAULT_TEMPLATES = [
  {
    type: 'email',
    notification_type: 'welcome',
    subject: 'Welcome to SoloCompass!',
    body: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>SoloCompass</title></head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; padding: 20px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        <tr><td style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 24px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">SoloCompass</h1>
          <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0; font-size: 14px;">Your AI Solo Travel Companion</p>
        </td></tr>
        <tr><td style="padding: 32px 24px;">
          <h2 style="color: #1e293b; margin: 0 0 16px 0; font-size: 24px;">Welcome to SoloCompass{{name ? \`, \${name}\` : ''}}! 🎉</h2>
          <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;">We're thrilled to have you as part of our solo exploration community. Your journey to safer, smarter, and more immersive travel starts now.</p>
          <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">With SoloCompass, you can:</p>
          <ul style="color: #475569; font-size: 15px; line-height: 1.8; margin: 0 0 24px 20px; padding: 0;">
            <li>Create personalized AI-powered trip itineraries</li>
            <li>Get real-time safety advisories for your destinations</li>
            <li>Track your travel budget effortlessly</li>
            <li>Connect with verified trip buddies</li>
            <li>Share your experiences with our community</li>
          </ul>
          <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding: 20px 0;">
            <a href="{{dashboardUrl}}" style="background-color: #6366f1; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; display: inline-block;">Go to Dashboard</a>
          </td></tr></table>
          <p style="color: #94a3b8; font-size: 13px; margin: 24px 0 0 0;">If you have any questions, just reply to this email!</p>
        </td></tr>
        <tr><td style="background-color: #f1f5f9; padding: 24px; text-align: center;">
          <p style="margin: 0; font-size: 12px; color: #94a3b8;">© {{year}} SoloCompass. All rights reserved.</p>
          <p style="margin: 8px 0 0 0; font-size: 12px; color: #94a3b8;"><a href="{{unsubscribeUrl}}" style="color: #94a3b8; text-decoration: underline;">Unsubscribe</a> from emails</p>
        </td></tr>
      </table></td></tr>
  </table>
</body>
</html>`,
    variables: ['name', 'dashboardUrl', 'unsubscribeUrl', 'year']
  },
  {
    type: 'email',
    notification_type: 'email_verification',
    subject: 'Verify your SoloCompass Account',
    body: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>SoloCompass</title></head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; padding: 20px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        <tr><td style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 24px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">SoloCompass</h1>
        </td></tr>
        <tr><td style="padding: 32px 24px;">
          <h2 style="color: #1e293b; margin: 0 0 16px 0; font-size: 24px;">Verify Your Email Address 📧</h2>
          <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;">Thanks for joining SoloCompass{{name ? \`, \${name}\` : ''}}! Please verify your email to activate your account.</p>
          <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding: 20px 0;">
            <a href="{{verifyUrl}}" style="background-color: #10b981; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; display: inline-block;">Verify My Account</a>
          </td></tr></table>
          <p style="color: #94a3b8; font-size: 13px; margin: 24px 0 0 0;">This link will expire in 24 hours.</p>
        </td></tr>
      </table></td></tr>
  </table>
</body>
</html>`,
    variables: ['name', 'verifyUrl']
  },
  {
    type: 'email',
    notification_type: 'password_reset',
    subject: 'Reset Your SoloCompass Password',
    body: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>SoloCompass</title></head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; padding: 20px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        <tr><td style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 24px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">SoloCompass</h1>
        </td></tr>
        <tr><td style="padding: 32px 24px;">
          <h2 style="color: #1e293b; margin: 0 0 16px 0; font-size: 24px;">Reset Your Password 🔐</h2>
          <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;">{{name ? \`\${name}, \` : ''}}You requested to reset your password.</p>
          <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding: 20px 0;">
            <a href="{{resetUrl}}" style="background-color: #6366f1; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; display: inline-block;">Reset My Password</a>
          </td></tr></table>
          <p style="color: #94a3b8; font-size: 13px; margin: 24px 0 0 0;">This link will expire in 1 hour.</p>
        </td></tr>
      </table></td></tr>
  </table>
</body>
</html>`,
    variables: ['name', 'resetUrl']
  },
  {
    type: 'email',
    notification_type: 'trip_reminder',
    subject: 'Trip Reminder: {{tripName}}',
    body: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>SoloCompass</title></head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; padding: 20px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        <tr><td style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 24px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">SoloCompass</h1>
        </td></tr>
        <tr><td style="padding: 32px 24px;">
          <h2 style="color: #1e293b; margin: 0 0 16px 0; font-size: 24px;">Trip Reminder ✈️</h2>
          <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;">Hi {{name}}, your trip to <strong>{{destination}}</strong> is coming up!</p>
          <div style="background-color: #f8fafc; border-radius: 8px; padding: 20px; margin: 0 0 24px 0;">
            <p style="color: #64748b; font-size: 14px; margin: 0;"><strong>Trip:</strong> {{tripName}}</p>
            <p style="color: #64748b; font-size: 14px; margin: 8px 0 0 0;"><strong>Start Date:</strong> {{startDate}}</p>
            <p style="color: #64748b; font-size: 14px; margin: 8px 0 0 0;"><strong>Days Until Departure:</strong> {{daysUntil}}</p>
          </div>
          <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding: 20px 0;">
            <a href="{{tripUrl}}" style="background-color: #10b981; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; display: inline-block;">View Trip Details</a>
          </td></tr></table>
        </td></tr>
      </table></td></tr>
  </table>
</body>
</html>`,
    variables: ['name', 'tripName', 'destination', 'startDate', 'daysUntil', 'tripUrl']
  },
  {
    type: 'email',
    notification_type: 'itinerary_ready',
    subject: 'Your Itinerary is Ready! {{tripName}}',
    body: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>SoloCompass</title></head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; padding: 20px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        <tr><td style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 24px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">SoloCompass</h1>
        </td></tr>
        <tr><td style="padding: 32px 24px;">
          <h2 style="color: #1e293b; margin: 0 0 16px 0; font-size: 24px;">Your Itinerary is Ready! 🎉</h2>
          <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;">Hi {{name}}, your AI-generated itinerary for <strong>{{tripName}}</strong> is ready!</p>
          <div style="background-color: #f0fdf4; border-left: 4px solid #10b981; padding: 16px; margin: 0 0 24px 0;">
            <p style="color: #1e293b; font-size: 14px; font-weight: 600; margin: 0 0 8px 0;">{{destination}}</p>
            <p style="color: #475569; font-size: 14px; margin: 0;">{{startDate}} - {{endDate}}</p>
          </div>
          <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding: 20px 0;">
            <a href="{{itineraryUrl}}" style="background-color: #10b981; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; display: inline-block;">View Full Itinerary</a>
          </td></tr></table>
        </td></tr>
      </table></td></tr>
  </table>
</body>
</html>`,
    variables: ['name', 'tripName', 'destination', 'startDate', 'endDate', 'itineraryUrl']
  },
  {
    type: 'email',
    notification_type: 'itinerary_failed',
    subject: 'Itinerary Generation Failed - {{tripName}}',
    body: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>SoloCompass</title></head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; padding: 20px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        <tr><td style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 24px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">SoloCompass</h1>
        </td></tr>
        <tr><td style="padding: 32px 24px;">
          <h2 style="color: #1e293b; margin: 0 0 16px 0; font-size: 24px;">Itinerary Generation Issue ⚠️</h2>
          <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;">Hi {{name}}, we couldn't generate your itinerary for <strong>{{tripName}}</strong>.</p>
          <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; margin: 0 0 24px 0;">
            <p style="color: #92400e; font-size: 14px; margin: 0;"><strong>Reason:</strong> {{errorMessage}}</p>
          </div>
          <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding: 20px 0;">
            <a href="{{tripUrl}}" style="background-color: #f59e0b; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; display: inline-block;">Try Again</a>
          </td></tr></table>
        </td></tr>
      </table></td></tr>
  </table>
</body>
</html>`,
    variables: ['name', 'tripName', 'errorMessage', 'tripUrl']
  },
  {
    type: 'email',
    notification_type: 'booking_change',
    subject: 'Booking Update: {{bookingType}} - {{tripName}}',
    body: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>SoloCompass</title></head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; padding: 20px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        <tr><td style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 24px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">SoloCompass</h1>
        </td></tr>
        <tr><td style="padding: 32px 24px;">
          <h2 style="color: #1e293b; margin: 0 0 16px 0; font-size: 24px;">Booking Update 📋</h2>
          <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;">Hi {{name}}, there's an update to your booking for <strong>{{tripName}}</strong>.</p>
          <div style="background-color: #f8fafc; border-radius: 8px; padding: 20px; margin: 0 0 24px 0;">
            <p style="color: #64748b; font-size: 14px; margin: 0;"><strong>Type:</strong> {{bookingType}}</p>
            <p style="color: #64748b; font-size: 14px; margin: 8px 0 0 0;"><strong>Details:</strong> {{changeDetails}}</p>
            <p style="color: #64748b; font-size: 14px; margin: 8px 0 0 0;"><strong>Confirmation:</strong> {{confirmationNumber}}</p>
          </div>
          <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding: 20px 0;">
            <a href="{{tripUrl}}" style="background-color: #6366f1; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; display: inline-block;">View Booking</a>
          </td></tr></table>
        </td></tr>
      </table></td></tr>
  </table>
</body>
</html>`,
    variables: ['name', 'tripName', 'bookingType', 'changeDetails', 'confirmationNumber', 'tripUrl']
  },
  {
    type: 'email',
    notification_type: 'safety_advisory',
    subject: 'Safety Advisory: {{destination}}',
    body: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>SoloCompass</title></head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; padding: 20px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        <tr><td style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); padding: 24px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">SoloCompass</h1>
        </td></tr>
        <tr><td style="padding: 32px 24px;">
          <h2 style="color: #1e293b; margin: 0 0 16px 0; font-size: 24px;">Safety Advisory 🛡️</h2>
          <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;">Hi {{name}}, there's an important safety update for your upcoming trip to <strong>{{destination}}</strong>.</p>
          <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 16px; margin: 0 0 24px 0;">
            <p style="color: #991b1b; font-size: 14px; font-weight: 600; margin: 0 0 8px 0;">{{advisoryTitle}}</p>
            <p style="color: #7f1d1d; font-size: 14px; margin: 0;">{{advisoryContent}}</p>
          </div>
          <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding: 20px 0;">
            <a href="{{advisoryUrl}}" style="background-color: #ef4444; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; display: inline-block;">View Full Advisory</a>
          </td></tr></table>
        </td></tr>
      </table></td></tr>
  </table>
</body>
</html>`,
    variables: ['name', 'destination', 'advisoryTitle', 'advisoryContent', 'advisoryUrl']
  },
  {
    type: 'email',
    notification_type: 'buddy_request',
    subject: 'Trip Buddy Request from {{senderName}}',
    body: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>SoloCompass</title></head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; padding: 20px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        <tr><td style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 24px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">SoloCompass</h1>
        </td></tr>
        <tr><td style="padding: 32px 24px;">
          <h2 style="color: #1e293b; margin: 0 0 16px 0; font-size: 24px;">Trip Buddy Request 👋</h2>
          <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;">Hi {{name}}, <strong>{{senderName}}</strong> wants to connect with you for a trip!</p>
          <div style="background-color: #f8fafc; border-radius: 8px; padding: 20px; margin: 0 0 24px 0;">
            <p style="color: #64748b; font-size: 14px; margin: 0;"><strong>Trip:</strong> {{tripName}}</p>
            <p style="color: #64748b; font-size: 14px; margin: 8px 0 0 0;"><strong>Destination:</strong> {{destination}}</p>
            <p style="color: #64748b; font-size: 14px; margin: 8px 0 0 0;"><strong>Message:</strong> {{message}}</p>
          </div>
          <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding: 20px 0;">
            <a href="{{requestUrl}}" style="background-color: #6366f1; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; display: inline-block;">View Request</a>
          </td></tr></table>
        </td></tr>
      </table></td></tr>
  </table>
</body>
</html>`,
    variables: ['name', 'senderName', 'tripName', 'destination', 'message', 'requestUrl']
  },
  {
    type: 'email',
    notification_type: 'buddy_accepted',
    subject: '{{senderName}} accepted your buddy request!',
    body: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>SoloCompass</title></head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; padding: 20px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        <tr><td style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 24px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">SoloCompass</h1>
        </td></tr>
        <tr><td style="padding: 32px 24px;">
          <h2 style="color: #1e293b; margin: 0 0 16px 0; font-size: 24px;">Buddy Request Accepted! 🎉</h2>
          <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;">Hi {{name}}, great news! <strong>{{senderName}}</strong> accepted your buddy request!</p>
          <div style="background-color: #f0fdf4; border-left: 4px solid #10b981; padding: 16px; margin: 0 0 24px 0;">
            <p style="color: #64748b; font-size: 14px; margin: 0;"><strong>Trip:</strong> {{tripName}}</p>
            <p style="color: #64748b; font-size: 14px; margin: 8px 0 0 0;"><strong>Destination:</strong> {{destination}}</p>
          </div>
          <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding: 20px 0;">
            <a href="{{profileUrl}}" style="background-color: #10b981; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; display: inline-block;">View Profile</a>
          </td></tr></table>
        </td></tr>
      </table></td></tr>
  </table>
</body>
</html>`,
    variables: ['name', 'senderName', 'tripName', 'destination', 'profileUrl']
  },
  {
    type: 'email',
    notification_type: 'subscription_upgraded',
    subject: 'Welcome to SoloCompass Premium!',
    body: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>SoloCompass</title></head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; padding: 20px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        <tr><td style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 24px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">SoloCompass Premium</h1>
        </td></tr>
        <tr><td style="padding: 32px 24px;">
          <h2 style="color: #1e293b; margin: 0 0 16px 0; font-size: 24px;">Welcome to Premium! ⭐</h2>
          <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;">Hi {{name}}, you're now a Premium member!</p>
          <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; margin: 0 0 24px 0;">
            <p style="color: #92400e; font-size: 14px; font-weight: 600; margin: 0 0 8px 0;">Your Premium Features:</p>
            <p style="color: #78350f; font-size: 14px; margin: 0;">• Unlimited trip itineraries</p>
            <p style="color: #78350f; font-size: 14px; margin: 4px 0 0 0;">• Advanced safety features</p>
            <p style="color: #78350f; font-size: 14px; margin: 4px 0 0 0;">• Priority buddy matching</p>
            <p style="color: #78350f; font-size: 14px; margin: 4px 0 0 0;">• Ad-free experience</p>
          </div>
          <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding: 20px 0;">
            <a href="{{dashboardUrl}}" style="background-color: #f59e0b; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; display: inline-block;">Explore Premium</a>
          </td></tr></table>
        </td></tr>
      </table></td></tr>
  </table>
</body>
</html>`,
    variables: ['name', 'planName', 'dashboardUrl']
  },
  {
    type: 'email',
    notification_type: 'payment_failed',
    subject: 'Payment Issue - Action Required',
    body: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>SoloCompass</title></head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; padding: 20px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        <tr><td style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); padding: 24px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">SoloCompass</h1>
        </td></tr>
        <tr><td style="padding: 32px 24px;">
          <h2 style="color: #1e293b; margin: 0 0 16px 0; font-size: 24px;">Payment Issue ⚠️</h2>
          <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;">Hi {{name}}, we couldn't process your payment.</p>
          <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 16px; margin: 0 0 24px 0;">
            <p style="color: #991b1b; font-size: 14px; margin: 0;"><strong>Amount:</strong> {{amount}}</p>
            <p style="color: #991b1b; font-size: 14px; margin: 8px 0 0 0;"><strong>Reason:</strong> {{failureReason}}</p>
          </div>
          <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding: 20px 0;">
            <a href="{{paymentUrl}}" style="background-color: #ef4444; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; display: inline-block;">Update Payment</a>
          </td></tr></table>
        </td></tr>
      </table></td></tr>
  </table>
</body>
</html>`,
    variables: ['name', 'amount', 'failureReason', 'paymentUrl']
  },
  {
    type: 'sms',
    notification_type: 'checkin_reminder',
    subject: '',
    body: 'Hi {{name}}, this is a reminder to check in for your trip to {{destination}}. Please confirm your safety by clicking: {{checkinUrl}}',
    variables: ['name', 'destination', 'checkinUrl']
  },
  {
    type: 'sms',
    notification_type: 'sos_alert',
    subject: '',
    body: '🚨 SOS ALERT: {{travelerName}} has not responded to safety check-ins for trip to {{destination}}. Last known location: {{lastLocation}}. Please contact them or local authorities immediately.',
    variables: ['travelerName', 'destination', 'lastLocation', 'emergencyContact']
  },
  {
    type: 'sms',
    notification_type: 'safe_checkin_sent',
    subject: '',
    body: '✅ {{travelerName}} has checked in safely from {{destination}}. Location: {{location}}. All clear!',
    variables: ['travelerName', 'destination', 'location']
  },
  {
    type: 'email',
    notification_type: 'booking_confirmation',
    subject: 'Booking Confirmed: {{bookingType}} for {{tripName}}',
    body: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>SoloCompass</title></head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; padding: 20px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        <tr><td style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 24px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">SoloCompass</h1>
          <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0; font-size: 14px;">Your AI Solo Travel Companion</p>
        </td></tr>
        <tr><td style="padding: 32px 24px;">
          <h2 style="color: #1e293b; margin: 0 0 16px 0; font-size: 24px;">Booking Confirmed ✅</h2>
          <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;">Hi {{name}}, your <strong>{{bookingType}}</strong> booking for <strong>{{tripName}}</strong> has been added.</p>
          <div style="background-color: #f0fdf4; border-left: 4px solid #10b981; border-radius: 8px; padding: 20px; margin: 0 0 24px 0;">
            <p style="color: #1e293b; font-size: 14px; font-weight: 600; margin: 0 0 12px 0;">Booking Details</p>
            <p style="color: #64748b; font-size: 14px; margin: 0;"><strong>Type:</strong> {{bookingType}}</p>
            <p style="color: #64748b; font-size: 14px; margin: 6px 0 0 0;"><strong>Provider:</strong> {{provider}}</p>
            <p style="color: #64748b; font-size: 14px; margin: 6px 0 0 0;"><strong>From:</strong> {{departureLocation}}</p>
            <p style="color: #64748b; font-size: 14px; margin: 6px 0 0 0;"><strong>To:</strong> {{arrivalLocation}}</p>
            <p style="color: #64748b; font-size: 14px; margin: 6px 0 0 0;"><strong>Departure:</strong> {{departureDate}}</p>
            {{#if confirmationNumber}}<p style="color: #64748b; font-size: 14px; margin: 6px 0 0 0;"><strong>Reference:</strong> {{confirmationNumber}}</p>{{/if}}
          </div>
          <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding: 20px 0;">
            <a href="{{tripUrl}}" style="background-color: #10b981; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; display: inline-block;">View Booking in App</a>
          </td></tr></table>
          <p style="color: #94a3b8; font-size: 13px; margin: 24px 0 0 0;">Keep your confirmation number safe — you may need it when travelling.</p>
        </td></tr>
        <tr><td style="background-color: #f1f5f9; padding: 24px; text-align: center;">
          <p style="margin: 0; font-size: 12px; color: #94a3b8;">© {{year}} SoloCompass. All rights reserved.</p>
          <p style="margin: 8px 0 0 0; font-size: 12px; color: #94a3b8;"><a href="{{unsubscribeUrl}}" style="color: #94a3b8; text-decoration: underline;">Unsubscribe</a> from emails</p>
        </td></tr>
      </table></td></tr>
  </table>
</body>
</html>`,
    variables: ['name', 'tripName', 'bookingType', 'provider', 'departureLocation', 'arrivalLocation', 'departureDate', 'confirmationNumber', 'tripUrl', 'year', 'unsubscribeUrl']
  },
  {
    type: 'email',
    notification_type: 'support_ticket_reply',
    subject: 'New Reply to Your Support Ticket #{{ticketId}}',
    body: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>SoloCompass Support</title></head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; padding: 20px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        <tr><td style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 24px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">SoloCompass Support</h1>
        </td></tr>
        <tr><td style="padding: 32px 24px;">
          <h2 style="color: #1e293b; margin: 0 0 16px 0; font-size: 24px;">New Reply on Ticket #{{ticketId}} 💬</h2>
          <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;">Hi {{name}}, the support team has replied to your ticket: <strong>{{ticketSubject}}</strong>.</p>
          <div style="background-color: #f8fafc; border-left: 4px solid #6366f1; border-radius: 4px; padding: 16px; margin: 0 0 24px 0;">
            <p style="color: #1e293b; font-size: 14px; font-weight: 600; margin: 0 0 8px 0;">Reply from {{replierName}}:</p>
            <p style="color: #475569; font-size: 14px; line-height: 1.6; margin: 0;">{{replyContent}}</p>
          </div>
          <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding: 20px 0;">
            <a href="{{ticketUrl}}" style="background-color: #6366f1; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; display: inline-block;">View Full Conversation</a>
          </td></tr></table>
        </td></tr>
        <tr><td style="background-color: #f1f5f9; padding: 24px; text-align: center;">
          <p style="margin: 0; font-size: 12px; color: #94a3b8;">© {{year}} SoloCompass. All rights reserved.</p>
        </td></tr>
      </table></td></tr>
  </table>
</body>
</html>`,
    variables: ['name', 'ticketId', 'ticketSubject', 'replierName', 'replyContent', 'ticketUrl', 'year']
  },
  {
    type: 'email',
    notification_type: 'support_ticket_status_change',
    subject: 'Your Support Ticket #{{ticketId}} Status Update',
    body: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>SoloCompass Support</title></head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; padding: 20px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        <tr><td style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 24px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">SoloCompass Support</h1>
        </td></tr>
        <tr><td style="padding: 32px 24px;">
          <h2 style="color: #1e293b; margin: 0 0 16px 0; font-size: 24px;">Ticket Status Updated 📋</h2>
          <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;">Hi {{name}}, your ticket <strong>{{ticketSubject}}</strong> (#{{ticketId}}) has been updated.</p>
          <div style="background-color: #f8fafc; border-radius: 8px; padding: 20px; margin: 0 0 24px 0;">
            <p style="color: #64748b; font-size: 14px; margin: 0;"><strong>Previous Status:</strong> {{oldStatus}}</p>
            <p style="color: #64748b; font-size: 14px; margin: 8px 0 0 0;"><strong>New Status:</strong> <span style="font-weight: 700; color: #10b981;">{{newStatus}}</span></p>
          </div>
          <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding: 20px 0;">
            <a href="{{ticketUrl}}" style="background-color: #6366f1; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; display: inline-block;">View Ticket</a>
          </td></tr></table>
        </td></tr>
        <tr><td style="background-color: #f1f5f9; padding: 24px; text-align: center;">
          <p style="margin: 0; font-size: 12px; color: #94a3b8;">© {{year}} SoloCompass. All rights reserved.</p>
        </td></tr>
      </table></td></tr>
  </table>
</body>
</html>`,
    variables: ['name', 'ticketId', 'ticketSubject', 'oldStatus', 'newStatus', 'ticketUrl', 'year']
  }
];

const TEMPLATE_PREVIEW_VARS = {
  welcome: { name: 'Alex', dashboardUrl: 'https://solocompass.app/dashboard', unsubscribeUrl: 'https://solocompass.app/settings', year: '2026' },
  email_verification: { name: 'Alex', verifyUrl: 'https://solocompass.app/verify?token=abc123' },
  password_reset: { name: 'Alex', resetUrl: 'https://solocompass.app/reset-password?token=abc123' },
  trip_reminder: { name: 'Alex', tripName: 'Tokyo Adventure', destination: 'Tokyo, Japan', startDate: 'April 15, 2026', daysUntil: '5', tripUrl: 'https://solocompass.app/trips/123' },
  itinerary_ready: { name: 'Alex', tripName: 'Tokyo Adventure', destination: 'Tokyo, Japan', startDate: 'April 15, 2026', endDate: 'April 22, 2026', itineraryUrl: 'https://solocompass.app/trips/123/itinerary' },
  itinerary_failed: { name: 'Alex', tripName: 'Tokyo Adventure', errorMessage: 'Unable to generate itinerary due to high demand. Please try again later.', tripUrl: 'https://solocompass.app/trips/123' },
  booking_change: { name: 'Alex', tripName: 'Tokyo Adventure', bookingType: 'Flight', changeDetails: 'Departure time changed from 10:00 AM to 2:00 PM', confirmationNumber: 'ABC123', tripUrl: 'https://solocompass.app/trips/123' },
  safety_advisory: { name: 'Alex', destination: 'Tokyo, Japan', advisoryTitle: 'Weather Alert', advisoryContent: 'Heavy rain expected in Tokyo region. Consider indoor activities.', advisoryUrl: 'https://solocompass.app/advisories/123' },
  buddy_request: { name: 'Alex', senderName: 'Sarah', tripName: 'Tokyo Adventure', destination: 'Tokyo, Japan', message: 'Hey! Would love to explore Tokyo together!', requestUrl: 'https://solocompass.app/buddies/requests' },
  buddy_accepted: { name: 'Alex', senderName: 'Sarah', tripName: 'Tokyo Adventure', destination: 'Tokyo, Japan', profileUrl: 'https://solocompass.app/profile/sarah' },
  subscription_upgraded: { name: 'Alex', planName: 'Premium', dashboardUrl: 'https://solocompass.app/dashboard' },
  payment_failed: { name: 'Alex', amount: '$9.99', failureReason: 'Card expired', paymentUrl: 'https://solocompass.app/settings/billing' },
  checkin_reminder: { name: 'Alex', destination: 'Tokyo, Japan', checkinUrl: 'https://solocompass.app/safety/checkin' },
  sos_alert: { travelerName: 'Alex Johnson', destination: 'Tokyo, Japan', lastLocation: 'Shinjuku Station', emergencyContact: 'Sarah' },
  safe_checkin_sent: { travelerName: 'Alex Johnson', destination: 'Tokyo, Japan', location: 'Shibuya, Tokyo' },
  booking_confirmation: { name: 'Alex', tripName: 'Tokyo Adventure', bookingType: 'Flight', provider: 'JAL', departureLocation: 'London Heathrow', arrivalLocation: 'Tokyo Narita', departureDate: 'April 15, 2026 10:30', confirmationNumber: 'JL406-ABC123', tripUrl: 'https://solocompass.app/trips/123', year: '2026', unsubscribeUrl: 'https://solocompass.app/settings?tab=notifications' },
  support_ticket_reply: { name: 'Alex', ticketId: '42', ticketSubject: 'Cannot access my trip', replierName: 'Support Team', replyContent: 'Thank you for reaching out. We have investigated and your trip is now accessible. Please try refreshing the page.', ticketUrl: 'https://solocompass.app/support/tickets/42', year: '2026' },
  support_ticket_status_change: { name: 'Alex', ticketId: '42', ticketSubject: 'Cannot access my trip', oldStatus: 'open', newStatus: 'resolved', ticketUrl: 'https://solocompass.app/support/tickets/42', year: '2026' }
};

async function initializeDefaultTemplates() {
  try {
    logger.info('[NotificationTemplateService] Ensuring default templates exist...');
    for (const template of DEFAULT_TEMPLATES) {
      await db.run(
        `INSERT INTO notification_templates (type, notification_type, subject, body, variables, is_active)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT (notification_type, type) DO NOTHING`,
        template.type,
        template.notification_type,
        template.subject || '',
        template.body,
        JSON.stringify(template.variables),
        true
      );
    }
    logger.info('[NotificationTemplateService] Default templates ensured');
  } catch (error) {
    logger.error('[NotificationTemplateService] Failed to initialize templates:', error.message);
  }
}

initializeDefaultTemplates();

function replaceVariables(template, vars) {
  let result = template;
  for (const [key, value] of Object.entries(vars || {})) {
    const regex = new RegExp(`{{${key}}}`, 'g');
    result = result.replace(regex, value || '');
  }
  return result;
}

export async function getAllTemplates() {
  const templates = await db.all('SELECT * FROM notification_templates ORDER BY type, notification_type');
  return templates.map(t => ({
    ...t,
    variables: typeof t.variables === 'string' ? JSON.parse(t.variables) : t.variables
  }));
}

export async function getTemplateById(id) {
  const template = await db.get('SELECT * FROM notification_templates WHERE id = ?', id);
  if (template) {
    template.variables = typeof template.variables === 'string' ? JSON.parse(template.variables) : template.variables;
  }
  return template;
}

export async function getTemplateByType(notificationType, type = 'email') {
  const template = await db.get(
    'SELECT * FROM notification_templates WHERE notification_type = ? AND type = ? AND is_active = true',
    notificationType,
    type
  );
  if (template) {
    template.variables = typeof template.variables === 'string' ? JSON.parse(template.variables) : template.variables;
  }
  return template;
}

export async function updateTemplate(id, updates) {
  const { subject, body, variables, is_active } = updates;
  await db.run(
    `UPDATE notification_templates SET subject = ?, body = ?, variables = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    subject,
    body,
    JSON.stringify(variables || []),
    is_active !== undefined ? is_active : true,
    id
  );
  return getTemplateById(id);
}

export function previewTemplate(notificationType, vars = {}, type = 'email') {
  return TEMPLATE_PREVIEW_VARS[notificationType] || {};
}

export async function sendTestNotification(templateId, recipientEmail, testVars = {}) {
  const template = await getTemplateById(templateId);
  if (!template) {
    throw new Error('Template not found');
  }

  const vars = { ...TEMPLATE_PREVIEW_VARS[template.notification_type], ...testVars };

  if (template.type === 'email') {
    const subject = replaceVariables(template.subject, vars);
    const body = replaceVariables(template.body, vars);
    
    const { sendEmail } = await import('./resendClient.js');
    return sendEmail({ to: recipientEmail, subject, html: body });
  } else if (template.type === 'sms') {
    const body = replaceVariables(template.body, vars);
    return { success: true, message: `SMS Preview: ${body}` };
  }

  throw new Error('Unknown template type');
}

export function getPreviewVariables(notificationType) {
  return TEMPLATE_PREVIEW_VARS[notificationType] || {};
}

export async function getAllNotificationTypes() {
  return DEFAULT_TEMPLATES.map(t => ({
    type: t.type,
    notification_type: t.notification_type,
    variables: t.variables
  }));
}

export default {
  getAllTemplates,
  getTemplateById,
  getTemplateByType,
  updateTemplate,
  previewTemplate,
  sendTestNotification,
  getPreviewVariables,
  getAllNotificationTypes
};

const BRAND = {
  name: 'SoloCompass',
  logo: 'https://solocompass.app/logo.png',
  primaryColor: '#6366f1',
  secondaryColor: '#10b981',
  accentColor: '#f59e0b',
  website: 'https://solocompass.app',
  facebook: 'https://facebook.com/solocompass',
  twitter: 'https://twitter.com/solocompass',
  instagram: 'https://instagram.com/solocompass',
  linkedin: 'https://linkedin.com/company/solocompass',
  unsubscribeUrl: 'https://solocompass.app/settings?tab=notifications'
};

const getHeader = (isEmergency = false) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${BRAND.name}</title>
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <style>
    /* Dark mode support for email clients that support prefers-color-scheme */
    @media (prefers-color-scheme: dark) {
      body, .email-body { background-color: #1e293b !important; }
      .email-content { background-color: #334155 !important; }
      .email-text { color: #e2e8f0 !important; }
      .email-subtext { color: #94a3b8 !important; }
    }
  </style>
</head>
<body class="email-body" style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif; background-color: #f8fafc;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; padding: 20px 0;">
    <tr>
      <td align="center">
        <table class="email-content" width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <tr>
            <td style="background: linear-gradient(135deg, ${BRAND.primaryColor} 0%, #8b5cf6 100%); padding: 24px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">
                ${isEmergency ? '🚨 ' : ''}${BRAND.name}
              </h1>
              <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0; font-size: 14px;">
                Your AI Solo Travel Companion
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px 24px;">
`;

const getFooter = (extraLinks = '') => `
            </td>
          </tr>
          <tr>
            <td style="background-color: #f1f5f9; padding: 24px; text-align: center;">
              <p style="margin: 0 0 12px 0; font-size: 13px; color: #64748b;">
                ${extraLinks}
              </p>
              <p style="margin: 0 0 8px 0;">
                <a href="${BRAND.facebook}" style="display: inline-block; margin: 0 8px; color: ${BRAND.primaryColor}; text-decoration: none;">Facebook</a>
                <a href="${BRAND.twitter}" style="display: inline-block; margin: 0 8px; color: ${BRAND.primaryColor}; text-decoration: none;">Twitter</a>
                <a href="${BRAND.instagram}" style="display: inline-block; margin: 0 8px; color: ${BRAND.primaryColor}; text-decoration: none;">Instagram</a>
                <a href="${BRAND.linkedin}" style="display: inline-block; margin: 0 8px; color: ${BRAND.primaryColor}; text-decoration: none;">LinkedIn</a>
              </p>
              <p style="margin: 12px 0 0 0; font-size: 12px; color: #94a3b8;">
                © ${new Date().getFullYear()} ${BRAND.name}. All rights reserved.
              </p>
              <p style="margin: 8px 0 0 0; font-size: 12px; color: #94a3b8;">
                <a href="${BRAND.unsubscribeUrl}" style="color: #94a3b8; text-decoration: underline;">Unsubscribe</a> from emails
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

const getButton = (url, text, color = BRAND.primaryColor) => `
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td align="center" style="padding: 20px 0;">
        <a href="${url}" style="background-color: ${color}; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; display: inline-block;">
          ${text}
        </a>
      </td>
    </tr>
  </table>
`;

const templates = {
  welcome: {
    subject: 'Welcome to SoloCompass!',
    getHtml: (vars) => {
      const { name, dashboardUrl } = vars;
      return getHeader() + `
              <h2 style="color: #1e293b; margin: 0 0 16px 0; font-size: 24px;">
                Welcome to SoloCompass${name ? `, ${name}` : ''}! 🎉
              </h2>
              <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;">
                We're thrilled to have you as part of our solo exploration community. Your journey to safer, smarter, and more immersive travel starts now.
              </p>
              <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
                With SoloCompass, you can:
              </p>
              <ul style="color: #475569; font-size: 15px; line-height: 1.8; margin: 0 0 24px 20px; padding: 0;">
                <li>Create personalized AI-powered trip itineraries</li>
                <li>Get real-time safety advisories for your destinations</li>
                <li>Track your travel budget effortlessly</li>
                <li>Connect with verified trip buddies</li>
                <li>Share your experiences with our community</li>
              </ul>
              ${getButton(dashboardUrl || `${BRAND.website}/dashboard`, 'Go to Dashboard')}
              <p style="color: #94a3b8; font-size: 13px; margin: 24px 0 0 0;">
                If you have any questions, just reply to this email!
              </p>
              ${getFooter()}
            `;
    },
    getText: (vars) => {
      const { name, dashboardUrl } = vars;
      return `Welcome to SoloCompass${name ? `, ${name}` : ''}!

We're thrilled to have you as part of our solo exploration community. Your journey to safer, smarter, and more immersive travel starts now.

With SoloCompass, you can:
- Create personalized AI-powered trip itineraries
- Get real-time safety advisories for your destinations
- Track your travel budget effortlessly
- Connect with verified trip buddies
- Share your experiences with our community

Go to your dashboard: ${dashboardUrl || `${BRAND.website}/dashboard`}

If you have any questions, just reply to this email!

© ${new Date().getFullYear()} SoloCompass. All rights reserved.
Unsubscribe: ${BRAND.unsubscribeUrl}`;
    }
  },

  emailVerification: {
    subject: 'Verify your SoloCompass Account',
    getHtml: (vars) => {
      const { name, verifyUrl } = vars;
      return getHeader() + `
              <h2 style="color: #1e293b; margin: 0 0 16px 0; font-size: 24px;">
                Verify Your Email Address 📧
              </h2>
              <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;">
                Thanks for joining SoloCompass${name ? `, ${name}` : ''}! Please verify your email to activate your account and start planning your next solo mission.
              </p>
              <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
                Click the button below to verify your email address:
              </p>
              ${getButton(verifyUrl, 'Verify My Account', BRAND.secondaryColor)}
              <p style="color: #94a3b8; font-size: 13px; margin: 24px 0 0 0;">
                If the button doesn't work, copy and paste this link into your browser:<br>
                ${verifyUrl}
              </p>
              <p style="color: #94a3b8; font-size: 13px; margin: 16px 0 0 0;">
                This link will expire in 24 hours.
              </p>
              ${getFooter()}
            `;
    },
    getText: (vars) => {
      const { name, verifyUrl } = vars;
      return `Verify Your Email Address

Thanks for joining SoloCompass${name ? `, ${name}` : ''}! Please verify your email to activate your account.

Verify your email: ${verifyUrl}

This link will expire in 24 hours.

© ${new Date().getFullYear()} SoloCompass. All rights reserved.
Unsubscribe: ${BRAND.unsubscribeUrl}`;
    }
  },

  passwordReset: {
    subject: 'Reset Your SoloCompass Password',
    getHtml: (vars) => {
      const { name, resetUrl } = vars;
      return getHeader() + `
              <h2 style="color: #1e293b; margin: 0 0 16px 0; font-size: 24px;">
                Reset Your Password 🔐
              </h2>
              <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;">
                ${name ? `${name}, ` : ''}You requested to reset your password. Click the button below to secure your account:
              </p>
              ${getButton(resetUrl, 'Reset My Password')}
              <p style="color: #94a3b8; font-size: 13px; margin: 24px 0 0 0;">
                This link will expire in 1 hour.
              </p>
              <p style="color: #94a3b8; font-size: 13px; margin: 16px 0 0 0;">
                If you didn't request this, you can safely ignore this email. Your password will remain unchanged.
              </p>
              ${getFooter()}
            `;
    },
    getText: (vars) => {
      const { name, resetUrl } = vars;
      return `Reset Your Password

${name ? `${name}, ` : ''}You requested to reset your password.

Reset your password: ${resetUrl}

This link will expire in 1 hour.

If you didn't request this, you can safely ignore this email.

© ${new Date().getFullYear()} SoloCompass. All rights reserved.
Unsubscribe: ${BRAND.unsubscribeUrl}`;
    }
  },

  tripConfirmation: {
    subject: 'Trip Confirmed! Your Itinerary is Ready',
    getHtml: (vars) => {
      const { name, tripName, destination, startDate, endDate, tripUrl, itinerary } = vars;
      return getHeader() + `
              <h2 style="color: #1e293b; margin: 0 0 16px 0; font-size: 24px;">
                Trip Confirmed! ✈️
              </h2>
              <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;">
                ${name ? `${name}, ` : ''}your trip to <strong>${destination || tripName}</strong> is all set!
              </p>
              <div style="background-color: #f8fafc; border-radius: 8px; padding: 20px; margin: 0 0 24px 0;">
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Destination</td>
                    <td style="padding: 8px 0; color: #1e293b; font-size: 14px; font-weight: 600; text-align: right;">${destination || tripName}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Start Date</td>
                    <td style="padding: 8px 0; color: #1e293b; font-size: 14px; font-weight: 600; text-align: right;">${startDate || 'TBD'}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #64748b; font-size: 14px;">End Date</td>
                    <td style="padding: 8px 0; color: #1e293b; font-size: 14px; font-weight: 600; text-align: right;">${endDate || 'TBD'}</td>
                  </tr>
                </table>
              </div>
              ${itinerary ? `
              <div style="background-color: #f0fdf4; border-left: 4px solid ${BRAND.secondaryColor}; padding: 16px; margin: 0 0 24px 0;">
                <p style="color: #1e293b; font-size: 14px; font-weight: 600; margin: 0 0 8px 0;">📋 Your AI-Generated Itinerary</p>
                <p style="color: #475569; font-size: 14px; line-height: 1.6; margin: 0; white-space: pre-wrap;">${itinerary.substring(0, 500)}${itinerary.length > 500 ? '...' : ''}</p>
              </div>
              ` : ''}
              ${getButton(tripUrl || `${BRAND.website}/trips`, 'View Full Itinerary', BRAND.secondaryColor)}
              <p style="color: #94a3b8; font-size: 13px; margin: 24px 0 0 0;">
                Need to make changes? You can edit your trip details anytime from your dashboard.
              </p>
              ${getFooter()}
            `;
    },
    getText: (vars) => {
      const { name, tripName, destination, startDate, endDate, tripUrl, itinerary } = vars;
      return `Trip Confirmed! ✈️

${name ? `${name}, ` : ''}your trip to ${destination || tripName} is all set!

Details:
- Destination: ${destination || tripName}
- Start Date: ${startDate || 'TBD'}
- End Date: ${endDate || 'TBD'}
${itinerary ? `\nYour AI-Generated Itinerary:\n${itinerary.substring(0, 500)}${itinerary.length > 500 ? '...' : ''}` : ''}

View your full itinerary: ${tripUrl || `${BRAND.website}/trips`}

© ${new Date().getFullYear()} SoloCompass. All rights reserved.
Unsubscribe: ${BRAND.unsubscribeUrl}`;
    }
  },

  safetyCheckIn: {
    subject: 'Safety Check-In: Is Your Traveler Okay?',
    getHtml: (vars) => {
      const { travelerName, tripName, destination, checkInUrl, emergencyContactName } = vars;
      return getHeader() + `
              <h2 style="color: #1e293b; margin: 0 0 16px 0; font-size: 24px;">
                Safety Check-In 🛡️
              </h2>
              <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;">
                Hi ${emergencyContactName || 'there'}, this is an automated check-in regarding <strong>${travelerName}</strong>.
              </p>
              <div style="background-color: #fef3c7; border-left: 4px solid ${BRAND.accentColor}; padding: 16px; margin: 0 0 24px 0;">
                <p style="color: #92400e; font-size: 14px; font-weight: 600; margin: 0 0 8px 0;">Traveler Details</p>
                <p style="color: #78350f; font-size: 14px; margin: 0;">Name: ${travelerName}</p>
                <p style="color: #78350f; font-size: 14px; margin: 4px 0 0 0;">Trip: ${tripName}</p>
                <p style="color: #78350f; font-size: 14px; margin: 4px 0 0 0;">Destination: ${destination}</p>
              </div>
              <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;">
                We haven't received a check-in response from ${travelerName.split(' ')[0]}. Please verify their safety if you can reach them.
              </p>
              ${getButton(checkInUrl || `${BRAND.website}/safety-checkin`, 'Check-In Status', BRAND.accentColor)}
              <p style="color: #94a3b8; font-size: 13px; margin: 24px 0 0 0;">
                This is an automated safety check. If there's an emergency, please contact local authorities immediately.
              </p>
              ${getFooter()}
            `;
    },
    getText: (vars) => {
      const { travelerName, tripName, destination, checkInUrl, emergencyContactName } = vars;
      return `Safety Check-In 🛡️

Hi ${emergencyContactName || 'there'}, this is an automated check-in regarding ${travelerName}.

Traveler Details:
- Name: ${travelerName}
- Trip: ${tripName}
- Destination: ${destination}

We haven't received a check-in response from ${travelerName.split(' ')[0]}. Please verify their safety if you can reach them.

Check-In Status: ${checkInUrl || `${BRAND.website}/safety-checkin`}

This is an automated safety check. If there's an emergency, please contact local authorities immediately.

© ${new Date().getFullYear()} SoloCompass. All rights reserved.
Unsubscribe: ${BRAND.unsubscribeUrl}`;
    }
  },

  emergencyAlert: {
    subject: '🚨 URGENT: Emergency Alert - SoloCompass',
    getHtml: (vars) => {
      const { travelerName, tripName, destination, emergencyContactName, contactPhone, message } = vars;
      return getHeader(true) + `
              <h2 style="color: #dc2626; margin: 0 0 16px 0; font-size: 24px; font-weight: 700;">
                🚨 URGENT: EMERGENCY ALERT
              </h2>
              <div style="background-color: #fef2f2; border: 2px solid #dc2626; border-radius: 8px; padding: 20px; margin: 0 0 24px 0;">
                <p style="color: #dc2626; font-size: 16px; font-weight: 600; margin: 0 0 12px 0;">Traveler in Potential Distress</p>
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding: 6px 0; color: #7f1d1d; font-size: 14px;">Traveler</td>
                    <td style="padding: 6px 0; color: #991b1b; font-size: 14px; font-weight: 600; text-align: right;">${travelerName}</td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; color: #7f1d1d; font-size: 14px;">Trip</td>
                    <td style="padding: 6px 0; color: #991b1b; font-size: 14px; font-weight: 600; text-align: right;">${tripName}</td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; color: #7f1d1d; font-size: 14px;">Location</td>
                    <td style="padding: 6px 0; color: #991b1b; font-size: 14px; font-weight: 600; text-align: right;">${destination}</td>
                  </tr>
                  ${contactPhone ? `
                  <tr>
                    <td style="padding: 6px 0; color: #7f1d1d; font-size: 14px;">Phone</td>
                    <td style="padding: 6px 0; color: #991b1b; font-size: 14px; font-weight: 600; text-align: right;">${contactPhone}</td>
                  </tr>
                  ` : ''}
                </table>
                ${message ? `
                <p style="color: #7f1d1d; font-size: 14px; font-weight: 600; margin: 16px 0 8px 0;">Message:</p>
                <p style="color: #991b1b; font-size: 14px; margin: 0;">${message}</p>
                ` : ''}
              </div>
              <p style="color: #dc2626; font-size: 16px; font-weight: 600; margin: 0 0 16px 0;">
                ⚠️ Please contact the traveler or local authorities immediately.
              </p>
              <p style="color: #475569; font-size: 14px; margin: 0 0 16px 0;">
                This alert was sent because the traveler did not respond to scheduled safety check-ins or triggered an emergency manually.
              </p>
              <p style="color: #94a3b8; font-size: 13px; margin: 0;">
                For immediate emergency assistance, contact local emergency services (911, 112, etc.).
              </p>
              ${getFooter()}
            `;
    },
    getText: (vars) => {
      const { travelerName, tripName, destination, emergencyContactName, contactPhone, message } = vars;
      return `🚨 URGENT: EMERGENCY ALERT

Traveler in Potential Distress:
- Traveler: ${travelerName}
- Trip: ${tripName}
- Location: ${destination}
${contactPhone ? `- Phone: ${contactPhone}` : ''}
${message ? `\nMessage:\n${message}` : ''}

⚠️ Please contact the traveler or local authorities immediately.

This alert was sent because the traveler did not respond to scheduled safety check-ins or triggered an emergency manually.

For immediate emergency assistance, contact local emergency services (911, 112, etc.).

© ${new Date().getFullYear()} SoloCompass. All rights reserved.`;
    }
  },

  paymentSuccess: {
    subject: 'Payment Successful - SoloCompass',
    getHtml: (vars) => {
      const { name, planName, amount, currency, nextBillingDate, dashboardUrl } = vars;
      return getHeader() + `
              <h2 class="email-text" style="color: #1e293b; margin: 0 0 16px 0; font-size: 24px;">
                Payment Successful ✅
              </h2>
              <p class="email-text" style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;">
                ${name ? `${name}, ` : ''}Your payment has been processed successfully!
              </p>
              <div style="background-color: #f0fdf4; border-radius: 8px; padding: 20px; margin: 0 0 24px 0; border-left: 4px solid ${BRAND.secondaryColor};">
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Plan</td>
                    <td style="padding: 8px 0; color: #1e293b; font-size: 14px; font-weight: 600; text-align: right;">${planName || 'Premium'}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Amount</td>
                    <td style="padding: 8px 0; color: #1e293b; font-size: 14px; font-weight: 600; text-align: right;">${currency || '£'}${amount || '0.00'}</td>
                  </tr>
                  ${nextBillingDate ? `
                  <tr>
                    <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Next Billing Date</td>
                    <td style="padding: 8px 0; color: #1e293b; font-size: 14px; font-weight: 600; text-align: right;">${nextBillingDate}</td>
                  </tr>
                  ` : ''}
                </table>
              </div>
              ${getButton(dashboardUrl || `${BRAND.website}/dashboard`, 'Go to Dashboard', BRAND.secondaryColor)}
              <p class="email-subtext" style="color: #94a3b8; font-size: 13px; margin: 24px 0 0 0;">
                You can manage your subscription anytime from <a href="${BRAND.website}/settings?tab=billing" style="color: ${BRAND.primaryColor};">Settings</a>.
              </p>
              ${getFooter()}
            `;
    },
    getText: (vars) => {
      const { name, planName, amount, currency, nextBillingDate, dashboardUrl } = vars;
      return `Payment Successful ✅

${name ? `${name}, ` : ''}Your payment has been processed successfully!

Plan: ${planName || 'Premium'}
Amount: ${currency || '£'}${amount || '0.00'}
${nextBillingDate ? `Next Billing Date: ${nextBillingDate}` : ''}

Go to your dashboard: ${dashboardUrl || `${BRAND.website}/dashboard`}

© ${new Date().getFullYear()} SoloCompass. All rights reserved.
Unsubscribe: ${BRAND.unsubscribeUrl}`;
    }
  },

  paymentFailed: {
    subject: '⚠️ Payment Failed - Action Required',
    getHtml: (vars) => {
      const { name, planName, amount, retryDate, updatePaymentUrl } = vars;
      return getHeader() + `
              <h2 class="email-text" style="color: #1e293b; margin: 0 0 16px 0; font-size: 24px;">
                Payment Failed ⚠️
              </h2>
              <p class="email-text" style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;">
                ${name ? `${name}, ` : ''}We were unable to process your payment for your <strong>${planName || 'Premium'}</strong> subscription.
              </p>
              <div style="background-color: #fef2f2; border-radius: 8px; padding: 20px; margin: 0 0 24px 0; border-left: 4px solid #ef4444;">
                <p style="color: #991b1b; font-size: 14px; font-weight: 600; margin: 0 0 8px 0;">Action Required</p>
                <p style="color: #7f1d1d; font-size: 14px; margin: 0;">
                  Please update your payment method to avoid losing access to your ${planName || 'Premium'} features.
                </p>
                ${retryDate ? `<p style="color: #7f1d1d; font-size: 13px; margin: 8px 0 0 0;">We'll automatically retry on <strong>${retryDate}</strong>.</p>` : ''}
              </div>
              ${getButton(updatePaymentUrl || `${BRAND.website}/settings?tab=billing`, 'Update Payment Method', '#ef4444')}
              <p class="email-subtext" style="color: #94a3b8; font-size: 13px; margin: 24px 0 0 0;">
                If you believe this is an error, please contact support.
              </p>
              ${getFooter()}
            `;
    },
    getText: (vars) => {
      const { name, planName, retryDate, updatePaymentUrl } = vars;
      return `Payment Failed ⚠️

${name ? `${name}, ` : ''}We were unable to process your payment for your ${planName || 'Premium'} subscription.

Please update your payment method to avoid losing access to your ${planName || 'Premium'} features.
${retryDate ? `We'll automatically retry on ${retryDate}.` : ''}

Update your payment method: ${updatePaymentUrl || `${BRAND.website}/settings?tab=billing`}

© ${new Date().getFullYear()} SoloCompass. All rights reserved.
Unsubscribe: ${BRAND.unsubscribeUrl}`;
    }
  },

  trialStarted: {
    subject: 'Your 7-Day Free Trial Has Started! 🎉',
    getHtml: (vars) => {
      const { name, trialEndDate, planName, dashboardUrl } = vars;
      return getHeader() + `
              <h2 class="email-text" style="color: #1e293b; margin: 0 0 16px 0; font-size: 24px;">
                Your Free Trial Has Started! 🎉
              </h2>
              <p class="email-text" style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;">
                ${name ? `${name}, ` : ''}Welcome to the <strong>${planName || 'Guardian'}</strong> experience! You have 7 days of full access.
              </p>
              <div style="background-color: #eef2ff; border-radius: 8px; padding: 20px; margin: 0 0 24px 0; border-left: 4px solid ${BRAND.primaryColor};">
                <p style="color: #3730a3; font-size: 14px; font-weight: 600; margin: 0 0 12px 0;">🔓 What's now unlocked:</p>
                <ul style="color: #4338ca; font-size: 14px; line-height: 1.8; margin: 0; padding: 0 0 0 20px;">
                  <li>Unlimited trips & AI itineraries</li>
                  <li>Scheduled check-ins + missed alerts</li>
                  <li>Safe-Return Timer</li>
                  <li>Safe haven locator</li>
                </ul>
              </div>
              ${trialEndDate ? `
              <p class="email-text" style="color: #475569; font-size: 14px; margin: 0 0 24px 0;">
                ⏰ Your trial ends on <strong>${trialEndDate}</strong>. You won't be charged unless you subscribe.
              </p>
              ` : ''}
              ${getButton(dashboardUrl || `${BRAND.website}/dashboard`, 'Start Exploring', BRAND.primaryColor)}
              ${getFooter()}
            `;
    },
    getText: (vars) => {
      const { name, trialEndDate, planName, dashboardUrl } = vars;
      return `Your Free Trial Has Started! 🎉

${name ? `${name}, ` : ''}Welcome to the ${planName || 'Guardian'} experience! You have 7 days of full access.

What's now unlocked:
- Unlimited trips & AI itineraries
- Scheduled check-ins + missed alerts
- Safe-Return Timer
- Safe haven locator

${trialEndDate ? `Your trial ends on ${trialEndDate}. You won't be charged unless you subscribe.` : ''}

Start exploring: ${dashboardUrl || `${BRAND.website}/dashboard`}

© ${new Date().getFullYear()} SoloCompass. All rights reserved.
Unsubscribe: ${BRAND.unsubscribeUrl}`;
    }
  },

  trialEnding: {
    subject: 'Your Free Trial Ends Soon ⏳',
    getHtml: (vars) => {
      const { name, trialEndDate, planName, upgradeUrl } = vars;
      return getHeader() + `
              <h2 class="email-text" style="color: #1e293b; margin: 0 0 16px 0; font-size: 24px;">
                Your Trial Ends Soon ⏳
              </h2>
              <p class="email-text" style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;">
                ${name ? `${name}, ` : ''}Your ${planName || 'Guardian'} free trial will end on <strong>${trialEndDate || 'soon'}</strong>.
              </p>
              <div style="background-color: #fffbeb; border-radius: 8px; padding: 20px; margin: 0 0 24px 0; border-left: 4px solid ${BRAND.accentColor};">
                <p style="color: #92400e; font-size: 14px; font-weight: 600; margin: 0 0 12px 0;">🔒 You'll lose access to:</p>
                <ul style="color: #78350f; font-size: 14px; line-height: 1.8; margin: 0; padding: 0 0 0 20px;">
                  <li>Unlimited trips & AI itineraries</li>
                  <li>Scheduled check-ins + missed alerts</li>
                  <li>Safe-Return Timer</li>
                  <li>Safe haven locator</li>
                </ul>
              </div>
              <p class="email-text" style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
                Upgrade now to keep all your ${planName || 'Guardian'} features — no interruption.
              </p>
              ${getButton(upgradeUrl || `${BRAND.website}/settings?tab=billing`, 'Upgrade Now', BRAND.accentColor)}
              ${getFooter()}
            `;
    },
    getText: (vars) => {
      const { name, trialEndDate, planName, upgradeUrl } = vars;
      return `Your Trial Ends Soon ⏳

${name ? `${name}, ` : ''}Your ${planName || 'Guardian'} free trial will end on ${trialEndDate || 'soon'}.

You'll lose access to:
- Unlimited trips & AI itineraries
- Scheduled check-ins + missed alerts
- Safe-Return Timer
- Safe haven locator

Upgrade now to keep all your ${planName || 'Guardian'} features.

Upgrade: ${upgradeUrl || `${BRAND.website}/settings?tab=billing`}

© ${new Date().getFullYear()} SoloCompass. All rights reserved.
Unsubscribe: ${BRAND.unsubscribeUrl}`;
    }
  },

  buddyRequest: {
    subject: 'New Travel Buddy Request! 🤝',
    getHtml: (vars) => {
      const { name, buddyName, buddyBio, destination, matchScore, buddiesUrl } = vars;
      return getHeader() + `
              <h2 class="email-text" style="color: #1e293b; margin: 0 0 16px 0; font-size: 24px;">
                New Buddy Request! 🤝
              </h2>
              <p class="email-text" style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
                ${name ? `${name}, ` : ''}Someone wants to travel with you!
              </p>
              <div style="background-color: #f8fafc; border-radius: 12px; padding: 24px; margin: 0 0 24px 0; border: 1px solid #e2e8f0; text-align: center;">
                <div style="width: 64px; height: 64px; background: linear-gradient(135deg, ${BRAND.primaryColor}, #8b5cf6); border-radius: 50%; margin: 0 auto 16px; display: flex; align-items: center; justify-content: center;">
                  <span style="font-size: 28px; line-height: 64px;">👤</span>
                </div>
                <p style="color: #1e293b; font-size: 18px; font-weight: 700; margin: 0 0 4px 0;">${buddyName || 'A fellow traveler'}</p>
                ${buddyBio ? `<p style="color: #64748b; font-size: 14px; margin: 0 0 12px 0;">${buddyBio.substring(0, 120)}${buddyBio.length > 120 ? '...' : ''}</p>` : ''}
                ${destination ? `<p style="color: #475569; font-size: 14px; margin: 0 0 8px 0;">📍 Destination: <strong>${destination}</strong></p>` : ''}
                ${matchScore ? `
                <div style="margin: 12px 0 0 0;">
                  <span style="background: linear-gradient(135deg, ${BRAND.primaryColor}, ${BRAND.secondaryColor}); color: white; padding: 6px 16px; border-radius: 20px; font-size: 14px; font-weight: 600;">
                    ${matchScore}% Match
                  </span>
                </div>
                ` : ''}
              </div>
              ${getButton(buddiesUrl || `${BRAND.website}/buddies`, 'View Request')}
              <p class="email-subtext" style="color: #94a3b8; font-size: 13px; margin: 24px 0 0 0;">
                You can manage buddy requests from your <a href="${BRAND.website}/buddies" style="color: ${BRAND.primaryColor};">Buddies</a> page.
              </p>
              ${getFooter()}
            `;
    },
    getText: (vars) => {
      const { name, buddyName, buddyBio, destination, matchScore, buddiesUrl } = vars;
      return `New Buddy Request! 🤝

${name ? `${name}, ` : ''}Someone wants to travel with you!

From: ${buddyName || 'A fellow traveler'}
${buddyBio ? `Bio: ${buddyBio.substring(0, 120)}` : ''}
${destination ? `Destination: ${destination}` : ''}
${matchScore ? `Match Score: ${matchScore}%` : ''}

View the request: ${buddiesUrl || `${BRAND.website}/buddies`}

© ${new Date().getFullYear()} SoloCompass. All rights reserved.
Unsubscribe: ${BRAND.unsubscribeUrl}`;
    }
  },

  weeklyDigest: {
    subject: 'Your Weekly SoloCompass Digest',
    getHtml: (vars) => {
      const { name, upcomingTrips, recentReviews, tripSuggestions, dashboardUrl } = vars;
      return getHeader() + `
              <h2 style="color: #1e293b; margin: 0 0 16px 0; font-size: 24px;">
                Your Weekly Travel Digest 📬
              </h2>
              <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
                ${name ? `${name}, ` : ''}here's what's happening with your SoloCompass account this week.
              </p>
              ${upcomingTrips && upcomingTrips.length > 0 ? `
              <div style="background-color: #f8fafc; border-radius: 8px; padding: 20px; margin: 0 0 24px 0;">
                <p style="color: #1e293b; font-size: 16px; font-weight: 600; margin: 0 0 12px 0;">✈️ Upcoming Trips</p>
                ${upcomingTrips.map(trip => `
                <div style="background-color: #ffffff; border-radius: 6px; padding: 12px; margin: 8px 0; border: 1px solid #e2e8f0;">
                  <p style="color: #1e293b; font-size: 14px; font-weight: 600; margin: 0;">${trip.name}</p>
                  <p style="color: #64748b; font-size: 13px; margin: 4px 0 0 0;">${trip.destination} • ${trip.dates}</p>
                </div>
                `).join('')}
              </div>
              ` : ''}
              ${tripSuggestions && tripSuggestions.length > 0 ? `
              <div style="background-color: #f0fdf4; border-radius: 8px; padding: 20px; margin: 0 0 24px 0;">
                <p style="color: #1e293b; font-size: 16px; font-weight: 600; margin: 0 0 12px 0;">🌍 Suggested Destinations</p>
                ${tripSuggestions.map(dest => `
                <div style="background-color: #ffffff; border-radius: 6px; padding: 12px; margin: 8px 0; border: 1px solid #bbf7d0;">
                  <p style="color: #1e293b; font-size: 14px; font-weight: 600; margin: 0;">${dest.name}</p>
                  <p style="color: #64748b; font-size: 13px; margin: 4px 0 0 0;">${dest.description}</p>
                </div>
                `).join('')}
              </div>
              ` : ''}
              ${recentReviews && recentReviews.length > 0 ? `
              <div style="background-color: #faf5ff; border-radius: 8px; padding: 20px; margin: 0 0 24px 0;">
                <p style="color: #1e293b; font-size: 16px; font-weight: 600; margin: 0 0 12px 0;">⭐ Recent Reviews</p>
                ${recentReviews.map(review => `
                <div style="background-color: #ffffff; border-radius: 6px; padding: 12px; margin: 8px 0; border: 1px solid #e9d5ff;">
                  <p style="color: #1e293b; font-size: 14px; font-weight: 600; margin: 0;">${review.destination}</p>
                  <p style="color: #64748b; font-size: 13px; margin: 4px 0 0 0;">${'⭐'.repeat(review.rating)} ${review.text.substring(0, 100)}...</p>
                </div>
                `).join('')}
              </div>
              ` : ''}
              ${getButton(dashboardUrl || `${BRAND.website}/dashboard`, 'View Dashboard')}
              <p style="color: #94a3b8; font-size: 13px; margin: 24px 0 0 0;">
                Want to change your email preferences? <a href="${BRAND.unsubscribeUrl}" style="color: ${BRAND.primaryColor};">Manage notifications</a>
              </p>
              ${getFooter()}
            `;
    },
    getText: (vars) => {
      const { name, upcomingTrips, recentReviews, tripSuggestions, dashboardUrl } = vars;
      return `Your Weekly Travel Digest 📬

${name ? `${name}, ` : ''}here's what's happening with your SoloCompass account this week.

${upcomingTrips && upcomingTrips.length > 0 ? `Upcoming Trips:\n${upcomingTrips.map(t => `- ${t.name}: ${t.destination} (${t.dates})`).join('\n')}\n\n` : ''}
${tripSuggestions && tripSuggestions.length > 0 ? `Suggested Destinations:\n${tripSuggestions.map(d => `- ${d.name}: ${d.description}`).join('\n')}\n\n` : ''}
${recentReviews && recentReviews.length > 0 ? `Recent Reviews:\n${recentReviews.map(r => `- ${r.destination} (${'⭐'.repeat(r.rating)}): ${r.text.substring(0, 100)}...`).join('\n')}\n\n` : ''}

View your dashboard: ${dashboardUrl || `${BRAND.website}/dashboard`}

Want to change your email preferences? Manage notifications: ${BRAND.unsubscribeUrl}

© ${new Date().getFullYear()} SoloCompass. All rights reserved.
Unsubscribe: ${BRAND.unsubscribeUrl}`;
    }
  },

  booking_confirmation: {
    subject: 'Your booking is confirmed — SoloCompass',
    getHtml: (vars) => {
      const {
        name, tripName, bookingType, provider, departureLocation, arrivalLocation,
        departureDate, confirmationNumber, tripUrl, year = new Date().getFullYear(), unsubscribeUrl = BRAND.unsubscribeUrl,
      } = vars;
      const title = [bookingType, provider].filter(Boolean).join(' · ');
      const checkedSubject = title || 'Booking';
      return getHeader() + `
              <h2 style="color: #1e293b; margin: 0 0 8px 0; font-size: 22px; font-weight: 800;">
                ✈️ Booking Confirmed!
              </h2>
              <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
                Hi ${name || 'there'}, your <strong>${checkedSubject}</strong> booking for
                <strong>${tripName || 'your trip'}</strong> has been added to SoloCompass.
              </p>

              <!-- Booking summary card -->
              <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; margin: 0 0 24px 0;">
                <table style="width: 100%; border-collapse: collapse;">
                  ${bookingType ? `<tr>
                    <td style="padding: 6px 0; color: #64748b; font-size: 13px; width: 40%;">Booking type</td>
                    <td style="padding: 6px 0; color: #1e293b; font-size: 14px; font-weight: 600;">${bookingType}</td>
                  </tr>` : ''}
                  ${provider ? `<tr>
                    <td style="padding: 6px 0; color: #64748b; font-size: 13px;">Provider</td>
                    <td style="padding: 6px 0; color: #1e293b; font-size: 14px; font-weight: 600;">${provider}</td>
                  </tr>` : ''}
                  ${departureLocation ? `<tr>
                    <td style="padding: 6px 0; color: #64748b; font-size: 13px;">From</td>
                    <td style="padding: 6px 0; color: #1e293b; font-size: 14px;">${departureLocation}</td>
                  </tr>` : ''}
                  ${arrivalLocation ? `<tr>
                    <td style="padding: 6px 0; color: #64748b; font-size: 13px;">To</td>
                    <td style="padding: 6px 0; color: #1e293b; font-size: 14px;">${arrivalLocation}</td>
                  </tr>` : ''}
                  ${departureDate ? `<tr>
                    <td style="padding: 6px 0; color: #64748b; font-size: 13px;">Date</td>
                    <td style="padding: 6px 0; color: #1e293b; font-size: 14px; font-weight: 600;">${departureDate}</td>
                  </tr>` : ''}
                  ${confirmationNumber ? `<tr>
                    <td style="padding: 6px 0; color: #64748b; font-size: 13px;">Confirmation ref</td>
                    <td style="padding: 6px 0; color: #1e293b; font-size: 14px; font-family: monospace; letter-spacing: 0.05em; font-weight: 700;">${confirmationNumber}</td>
                  </tr>` : ''}
                </table>
              </div>

              ${getButton(tripUrl || BRAND.website + '/trips', 'View Trip in SoloCompass')}

              <p style="color: #94a3b8; font-size: 12px; margin: 24px 0 0 0; line-height: 1.6;">
                Keep all your travel bookings organised in one place — flights, trains, hotels, and more.
                <br>
                <a href="${unsubscribeUrl}" style="color: #94a3b8; text-decoration: underline;">Manage notifications</a>
              </p>
              ${getFooter()}
            `;
    },
    getText: (vars) => {
      const {
        name, tripName, bookingType, provider, departureLocation, arrivalLocation,
        departureDate, confirmationNumber, tripUrl, unsubscribeUrl = BRAND.unsubscribeUrl,
      } = vars;
      return `Booking Confirmed ✈️

Hi ${name || 'there'}, your booking for ${tripName || 'your trip'} has been added to SoloCompass.

${bookingType ? `Type:              ${bookingType}\n` : ''}${provider ? `Provider:          ${provider}\n` : ''}${departureLocation ? `From:              ${departureLocation}\n` : ''}${arrivalLocation ? `To:                ${arrivalLocation}\n` : ''}${departureDate ? `Date:              ${departureDate}\n` : ''}${confirmationNumber ? `Confirmation ref:  ${confirmationNumber}\n` : ''}
View trip: ${tripUrl || BRAND.website + '/trips'}

Manage notifications: ${unsubscribeUrl}

© ${new Date().getFullYear()} SoloCompass. All rights reserved.`;
    },
  },
};

export const getTemplate = (type) => templates[type];

export const renderTemplate = (type, vars, format = 'html') => {
  const template = templates[type];
  if (!template) {
    throw new Error(`Unknown email template: ${type}`);
  }
  
  if (format === 'text') {
    return { subject: template.subject, body: template.getText(vars) };
  }
  
  return { subject: template.subject, body: template.getHtml(vars) };
};

export const getAvailableTemplates = () => Object.keys(templates);

export const getTemplatePreviewVars = () => ({
  welcome: {
    name: 'Alex',
    dashboardUrl: 'https://solocompass.app/dashboard'
  },
  emailVerification: {
    name: 'Alex',
    verifyUrl: 'https://solocompass.app/api/auth/verify?token=abc123'
  },
  passwordReset: {
    name: 'Alex',
    resetUrl: 'https://solocompass.app/reset-password?token=abc123'
  },
  tripConfirmation: {
    name: 'Alex',
    tripName: 'Tokyo Adventure',
    destination: 'Tokyo, Japan',
    startDate: 'April 15, 2026',
    endDate: 'April 22, 2026',
    tripUrl: 'https://solocompass.app/trips/123',
    itinerary: `Day 1: Arrival in Tokyo
- Check into Shinjuku hotel
- Explore Shinjuku nightlife
- Dinner at Omoide Yokocho

Day 2: Classic Tokyo
- Visit Senso-ji Temple
- Walk through Nakamise Street
- Tokyo Skytree at sunset

Day 3: Modern Tokyo
- Harajuku and Takeshita Street
- Meiji Shrine
- Shibuya Crossing

Day 4: Food Tour
- Tsukiji Outer Market
- Ramen tasting in Shinjuku
- Evening in Golden Gai`
  },
  safetyCheckIn: {
    travelerName: 'Alex Johnson',
    tripName: 'Tokyo Adventure',
    destination: 'Tokyo, Japan',
    checkInUrl: 'https://solocompass.app/safety-checkin',
    emergencyContactName: 'Sarah'
  },
  emergencyAlert: {
    travelerName: 'Alex Johnson',
    tripName: 'Tokyo Adventure',
    destination: 'Tokyo, Japan',
    emergencyContactName: 'Sarah',
    contactPhone: '+1-555-0123',
    message: 'Last seen at Shinjuku station, feeling unwell.'
  },
  paymentSuccess: {
    name: 'Alex',
    planName: 'Guardian',
    amount: '4.99',
    currency: '£',
    nextBillingDate: 'May 16, 2026',
    dashboardUrl: 'https://solocompass.app/dashboard'
  },
  paymentFailed: {
    name: 'Alex',
    planName: 'Guardian',
    amount: '4.99',
    retryDate: 'April 19, 2026',
    updatePaymentUrl: 'https://solocompass.app/settings?tab=billing'
  },
  trialStarted: {
    name: 'Alex',
    trialEndDate: 'April 23, 2026',
    planName: 'Guardian',
    dashboardUrl: 'https://solocompass.app/dashboard'
  },
  trialEnding: {
    name: 'Alex',
    trialEndDate: 'April 23, 2026',
    planName: 'Guardian',
    upgradeUrl: 'https://solocompass.app/settings?tab=billing'
  },
  buddyRequest: {
    name: 'Alex',
    buddyName: 'Jamie Lee',
    buddyBio: 'Solo backpacker exploring Southeast Asia. Love hiking, street food, and meeting fellow travelers!',
    destination: 'Chiang Mai, Thailand',
    matchScore: 87,
    buddiesUrl: 'https://solocompass.app/buddies'
  },
  weeklyDigest: {
    name: 'Alex',
    upcomingTrips: [
      { name: 'Tokyo Adventure', destination: 'Tokyo, Japan', dates: 'Apr 15-22' },
      { name: 'Barcelona Getaway', destination: 'Barcelona, Spain', dates: 'May 5-10' }
    ],
    recentReviews: [
      { destination: 'Paris, France', rating: 5, text: 'Amazing solo travel experience! The hostels were fantastic and very safe.' },
      { destination: 'Bangkok, Thailand', rating: 4, text: 'Great food scene and very friendly locals. Would definitely recommend.' }
    ],
    tripSuggestions: [
      { name: 'Lisbon, Portugal', description: 'Affordable, safe, and rich in culture' },
      { name: 'Costa Rica', description: 'Perfect for adventure seekers' }
    ],
    dashboardUrl: 'https://solocompass.app/dashboard'
  },
  booking_confirmation: {
    name: 'Alex',
    tripName: 'Tokyo Adventure',
    bookingType: 'Flight',
    provider: 'Japan Airlines',
    departureLocation: 'London Heathrow (LHR)',
    arrivalLocation: 'Tokyo Narita (NRT)',
    departureDate: '15 Apr 2026, 10:30',
    confirmationNumber: 'JL406-ABC123',
    tripUrl: 'https://solocompass.app/trips/123',
    year: String(new Date().getFullYear()),
    unsubscribeUrl: 'https://solocompass.app/settings?tab=notifications',
  }
});

export default templates;

/**
 * emailScheduler.js — background scheduler for transactional lifecycle emails.
 *
 * Runs two jobs via setInterval (same pattern as checkinMonitor):
 *   1. Onboarding re-engagement  — sends a 24h nudge email to users who started
 *      onboarding but haven't completed it and haven't been nudged yet.
 *   2. Pre-deletion warnings     — sends warning emails at 7d / 3d / 1d before the
 *      scheduled purge date for accounts that requested deletion.
 */

import db from '../db.js';
import { sendEmail } from './resendClient.js';
import logger from './logger.js';

const FRONTEND_URL = process.env.FRONTEND_URL || 'https://solocompass.app';

// ─── Email builders ──────────────────────────────────────────────────────────

const buildOnboardingReEngagementEmail = (name) => ({
  subject: `${name ? name + ', c' : 'C'}ontinue setting up your SoloCompass profile 🌍`,
  html: `
<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f8fafc;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:20px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1);">
        <tr><td style="background:linear-gradient(135deg,#10b981 0%,#059669 100%);padding:24px;text-align:center;">
          <h1 style="color:#fff;margin:0;font-size:28px;font-weight:700;">SoloCompass</h1>
          <p style="color:rgba(255,255,255,.9);margin:8px 0 0;font-size:14px;">Your AI Solo Travel Companion</p>
        </td></tr>
        <tr><td style="padding:32px 24px;">
          <h2 style="color:#1e293b;font-size:22px;margin:0 0 12px;">You're almost ready to explore, ${name || 'traveller'}!</h2>
          <p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 20px;">
            You started setting up your SoloCompass profile but didn't quite finish. Complete your onboarding to unlock buddy matching, personalised trip recommendations, and safety check-ins.
          </p>
          <div style="text-align:center;margin:28px 0;">
            <a href="${FRONTEND_URL}/onboarding" style="background:#10b981;color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:700;font-size:15px;display:inline-block;">
              Complete My Profile →
            </a>
          </div>
          <p style="color:#94a3b8;font-size:13px;margin:20px 0 0;">
            Takes less than 3 minutes. You can skip any step and come back later.
          </p>
        </td></tr>
        <tr><td style="background:#f1f5f9;padding:20px 24px;text-align:center;">
          <p style="margin:0;font-size:12px;color:#94a3b8;">
            © ${new Date().getFullYear()} SoloCompass. All rights reserved.
            <br><a href="${FRONTEND_URL}/settings?tab=notifications" style="color:#94a3b8;text-decoration:underline;">Unsubscribe</a> from emails
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`.trim(),
});

const buildDeletionWarningEmail = (name, daysLeft, purgeDate) => ({
  subject: `⚠️ Your SoloCompass account will be deleted in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`,
  html: `
<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f8fafc;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:20px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1);">
        <tr><td style="background:linear-gradient(135deg,#ef4444 0%,#dc2626 100%);padding:24px;text-align:center;">
          <h1 style="color:#fff;margin:0;font-size:28px;font-weight:700;">⚠️ Account Deletion Warning</h1>
        </td></tr>
        <tr><td style="padding:32px 24px;">
          <h2 style="color:#1e293b;font-size:22px;margin:0 0 12px;">Hi ${name || 'there'},</h2>
          <p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 16px;">
            Your SoloCompass account is scheduled for <strong>permanent deletion on ${purgeDate}</strong> — that's <strong>${daysLeft} day${daysLeft === 1 ? '' : 's'} away</strong>.
          </p>
          <p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 20px;">
            Once deleted, all your trips, itineraries, safety data, and account information will be <strong>permanently removed</strong> and cannot be recovered.
          </p>
          <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px;margin:0 0 24px;">
            <p style="color:#dc2626;margin:0;font-size:14px;font-weight:600;">
              Changed your mind? You can cancel deletion by contacting our support team before ${purgeDate}.
            </p>
          </div>
          <div style="text-align:center;margin:28px 0;">
            <a href="${FRONTEND_URL}/settings?tab=data" style="background:#10b981;color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:700;font-size:15px;display:inline-block;">
              Download My Data Archive
            </a>
          </div>
          <p style="color:#94a3b8;font-size:13px;margin:0;">
            Need to cancel? <a href="mailto:support@solocompass.app" style="color:#10b981;">Contact support</a>
          </p>
        </td></tr>
        <tr><td style="background:#f1f5f9;padding:20px 24px;text-align:center;">
          <p style="margin:0;font-size:12px;color:#94a3b8;">
            © ${new Date().getFullYear()} SoloCompass. All rights reserved.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`.trim(),
});

// ─── Job: Onboarding re-engagement (runs every 30 minutes) ───────────────────

async function runOnboardingReEngagementJob() {
  try {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(); // 24h ago
    // Users who created their onboarding record >24h ago, haven't completed, haven't been nudged
    const stale = await db.all(`
      SELECT os.user_id, os.updated_at, u.email, u.name
      FROM onboarding_state os
      JOIN users u ON u.id = os.user_id
      WHERE os.completed = false
        AND os.re_engagement_sent = false
        AND os.updated_at < $1
        AND u.deleted_at IS NULL
    `, cutoff);

    for (const row of stale) {
      try {
        const { subject, html } = buildOnboardingReEngagementEmail(row.name);
        await sendEmail({ to: row.email, subject, html });
        await db.run(
          'UPDATE onboarding_state SET re_engagement_sent = true, re_engagement_sent_at = CURRENT_TIMESTAMP WHERE user_id = $1',
          row.user_id
        );
        logger.info(`[EmailScheduler] Onboarding re-engagement sent to user ${row.user_id}`);
      } catch (err) {
        logger.error(`[EmailScheduler] Failed to send re-engagement to user ${row.user_id}: ${err.message}`);
      }
    }
  } catch (err) {
    logger.error(`[EmailScheduler] Onboarding re-engagement job error: ${err.message}`);
  }
}

// ─── Job: Pre-deletion warnings (runs every 6 hours) ─────────────────────────

async function runPreDeletionWarningJob() {
  try {
    const pending = await db.all(`
      SELECT adr.id, adr.user_id, adr.scheduled_purge_date,
             adr.warning_7d_sent, adr.warning_3d_sent, adr.warning_1d_sent,
             u.email, u.name
      FROM account_deletion_requests adr
      JOIN users u ON u.id = adr.user_id
      WHERE adr.status = 'pending'
    `);

    const now = Date.now();

    for (const row of pending) {
      const purgeMs = new Date(row.scheduled_purge_date).getTime();
      const msLeft = purgeMs - now;
      const daysLeft = Math.ceil(msLeft / (24 * 60 * 60 * 1000));
      const purgeDate = new Date(row.scheduled_purge_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

      const warnings = [
        { daysLeft: 7, field: 'warning_7d_sent', sent: row.warning_7d_sent },
        { daysLeft: 3, field: 'warning_3d_sent', sent: row.warning_3d_sent },
        { daysLeft: 1, field: 'warning_1d_sent', sent: row.warning_1d_sent },
      ];

      for (const w of warnings) {
        if (!w.sent && daysLeft <= w.daysLeft && daysLeft >= 0) {
          try {
            const { subject, html } = buildDeletionWarningEmail(row.name, daysLeft, purgeDate);
            await sendEmail({ to: row.email, subject, html });
            await db.run(
              `UPDATE account_deletion_requests SET ${w.field} = true WHERE id = $1`,
              row.id
            );
            logger.info(`[EmailScheduler] Deletion ${w.daysLeft}d warning sent to user ${row.user_id}`);
          } catch (err) {
            logger.error(`[EmailScheduler] Failed to send deletion warning to user ${row.user_id}: ${err.message}`);
          }
          break; // Only send one warning email per run per user
        }
      }
    }
  } catch (err) {
    logger.error(`[EmailScheduler] Pre-deletion warning job error: ${err.message}`);
  }
}

// ─── Scheduler entry point ────────────────────────────────────────────────────

const RE_ENGAGEMENT_INTERVAL_MS = 30 * 60 * 1000;    // 30 minutes
const DELETION_WARNING_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours

export function startEmailScheduler() {
  logger.info('[EmailScheduler] Starting email lifecycle scheduler');

  // Run immediately on startup, then on interval
  runOnboardingReEngagementJob();
  runPreDeletionWarningJob();

  setInterval(runOnboardingReEngagementJob, RE_ENGAGEMENT_INTERVAL_MS);
  setInterval(runPreDeletionWarningJob, DELETION_WARNING_INTERVAL_MS);
}

export { runOnboardingReEngagementJob, runPreDeletionWarningJob };

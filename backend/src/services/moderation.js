import db from '../db.js';
import logger from './logger.js';

export async function handleBuddyReportCreated({ reportId, reportedId }) {
  try {
    const pendingCountRow = await db.prepare(`
      SELECT COUNT(*)::int AS count
      FROM buddy_reports
      WHERE reported_id = ? AND status = 'pending'
    `).get(reportedId);

    const pendingCount = pendingCountRow?.count || 0;
    if (pendingCount < 3) {
      return { flagged: false, pendingCount };
    }

    await db.prepare(`
      UPDATE users
      SET is_flagged = true, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(reportedId);

    const admins = await db.prepare(`
      SELECT id
      FROM users
      WHERE role = 'admin'
    `).all();

    for (const admin of admins) {
      await db.prepare(`
        INSERT INTO notifications (user_id, type, title, message, data)
        VALUES (?, 'moderation_report', 'User flagged for moderation', ?, ?)
      `).run(
        admin.id,
        `User ${reportedId} has ${pendingCount} pending reports and was auto-flagged.`,
        JSON.stringify({ reportId, reportedId, pendingCount })
      );
    }

    logger.warn(`[Moderation] User ${reportedId} auto-flagged with ${pendingCount} pending buddy reports`);
    return { flagged: true, pendingCount };
  } catch (error) {
    logger.error(`[Moderation] Failed processing buddy report ${reportId}: ${error.message}`);
    return { flagged: false, pendingCount: 0, error: true };
  }
}

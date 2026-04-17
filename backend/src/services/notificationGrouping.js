import db from '../db.js';
import logger from './logger.js';

/**
 * Group similar notifications for a user
 * Collapses notifications of the same type within a 1-hour window into a single grouped notification
 */
export async function groupNotifications(userId) {
  try {
    // Find ungrouped notifications of the same type within the last hour
    const ungrouped = await db.prepare(`
      SELECT type, COUNT(*) as count, MIN(id) as first_id, MAX(id) as last_id,
             MIN(created_at) as first_at, MAX(created_at) as last_at
      FROM notifications 
      WHERE user_id = ? AND is_read = false AND created_at > NOW() - INTERVAL '1 hour'
      GROUP BY type 
      HAVING COUNT(*) > 1
    `).all(userId);

    const grouped = [];
    for (const group of ungrouped) {
      if (group.count >= 3) {
        // Mark all but the first as grouped
        await db.run(
          `UPDATE notifications SET data = jsonb_set(COALESCE(data::jsonb, '{}'::jsonb), '{grouped}', 'true') 
           WHERE user_id = ? AND type = ? AND id != ? AND is_read = false AND created_at > NOW() - INTERVAL '1 hour'`,
          userId, group.type, group.first_id
        );
        // Update first notification to show group count
        await db.run(
          `UPDATE notifications SET message = message || ' (+' || ? || ' more)', 
           data = jsonb_set(COALESCE(data::jsonb, '{}'::jsonb), '{group_count}', ?::jsonb)
           WHERE id = ?`,
          group.count - 1, JSON.stringify(group.count), group.first_id
        );
        grouped.push({ type: group.type, count: group.count });
      }
    }
    return { success: true, data: grouped };
  } catch (err) {
    logger.error('[NotificationGrouping] Error:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Auto-cleanup old notifications (archive after 90 days)
 */
export async function cleanupOldNotifications() {
  try {
    const result = await db.run(
      `DELETE FROM notifications WHERE created_at < NOW() - INTERVAL '90 days' AND is_read = true`
    );
    logger.info(`[NotificationCleanup] Archived ${result.changes} old notifications`);
    return { success: true, deleted: result.changes };
  } catch (err) {
    logger.error('[NotificationCleanup] Error:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Get notification delivery analytics
 */
export async function getNotificationAnalytics(days = 30) {
  try {
    const stats = await db.prepare(`
      SELECT 
        notification_type,
        channel,
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'delivered' THEN 1 END) as delivered,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed,
        COUNT(CASE WHEN opened_at IS NOT NULL THEN 1 END) as opened,
        COUNT(CASE WHEN clicked_at IS NOT NULL THEN 1 END) as clicked
      FROM notification_logs
      WHERE created_at > NOW() - INTERVAL '1 day' * ?
      GROUP BY notification_type, channel
      ORDER BY total DESC
    `).all(days);

    return {
      success: true,
      data: {
        stats,
        summary: {
          totalSent: stats.reduce((sum, s) => sum + parseInt(s.total), 0),
          totalDelivered: stats.reduce((sum, s) => sum + parseInt(s.delivered), 0),
          totalFailed: stats.reduce((sum, s) => sum + parseInt(s.failed), 0),
          totalOpened: stats.reduce((sum, s) => sum + parseInt(s.opened), 0),
          totalClicked: stats.reduce((sum, s) => sum + parseInt(s.clicked), 0),
        }
      }
    };
  } catch (err) {
    logger.error('[NotificationAnalytics] Error:', err.message);
    return { success: false, error: err.message };
  }
}

export default { groupNotifications, cleanupOldNotifications, getNotificationAnalytics };

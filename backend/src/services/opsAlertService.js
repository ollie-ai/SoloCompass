import logger from './logger.js';
import db from '../db.js';
import { OPS_ALERT_TYPES, OPS_SEVERITY } from './notificationRegistry.js';
import { dispatchOpsAlert } from './opsAlertDispatcher.js';

export async function createOpsAlert({
  type,
  severity,
  notificationType = null,
  affectedUserId = null,
  provider = null,
  errorDetails = null,
}) {
  try {
    const result = await db.prepare(`
      INSERT INTO ops_alerts (type, severity, notification_type, affected_user_id, provider, error_details)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(type, severity, notificationType, affectedUserId, provider, JSON.stringify(errorDetails));

    const alertId = result.lastInsertRowid;

    logger.warn(`[OpsAlert] Created alert: ${type} - ${severity}`, {
      alertId,
      notificationType,
      provider,
      errorDetails,
    });

    // Fire-and-forget outbound dispatch (Slack / PagerDuty / Discord)
    dispatchOpsAlert({ alertId, type, severity, errorDetails }).catch((err) =>
      logger.error(`[OpsAlert] Dispatcher error: ${err.message}`)
    );

    return { success: true, id: alertId };
  } catch (error) {
    logger.error('[OpsAlert] Failed to create alert:', error.message);
    return { success: false, error: error.message };
  }
}

export async function createDeliveryFailureAlert({
  notificationType,
  channel,
  userId,
  provider,
  errorMessage,
  retryCount = 0,
}) {
  const isCritical = ['P0', 'P1'].includes(notificationType?.split('_')[0]);

  return createOpsAlert({
    type: OPS_ALERT_TYPES.DELIVERY_FAILURE,
    severity: isCritical ? OPS_SEVERITY.CRITICAL : OPS_SEVERITY.WARNING,
    notificationType,
    affectedUserId: userId,
    provider,
    errorDetails: {
      channel,
      errorMessage,
      retryCount,
      timestamp: new Date().toISOString(),
    },
  });
}

export async function createProviderOutageAlert({
  provider,
  errorMessage,
  isRecovery = false,
}) {
  return createOpsAlert({
    type: OPS_ALERT_TYPES.PROVIDER_OUTAGE,
    severity: isRecovery ? OPS_SEVERITY.INFO : OPS_SEVERITY.CRITICAL,
    provider,
    errorDetails: {
      errorMessage,
      isRecovery,
      timestamp: new Date().toISOString(),
    },
  });
}

export async function getOpenAlerts({ limit = 50, offset = 0, severity = null } = {}) {
  try {
    let query = `
      SELECT 
        oa.*,
        u.email as user_email,
        u.name as user_name
      FROM ops_alerts oa
      LEFT JOIN users u ON oa.affected_user_id = u.id
      WHERE oa.status = 'open'
    `;
    const params = [];

    if (severity) {
      query += ' AND oa.severity = ?';
      params.push(severity);
    }

    query += ' ORDER BY oa.created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const alerts = await db.prepare(query).all(...params);
    const countResult = await db.prepare(`
      SELECT COUNT(*) as count FROM ops_alerts WHERE status = 'open'
      ${severity ? 'AND severity = ?' : ''}
    `).get(...(severity ? [severity] : []));

    return {
      alerts,
      total: countResult?.count || 0,
    };
  } catch (error) {
    logger.error('[OpsAlert] Failed to get alerts:', error.message);
    return { alerts: [], total: 0 };
  }
}

export async function resolveAlert(alertId) {
  try {
    await db.prepare(`
      UPDATE ops_alerts 
      SET status = 'resolved', resolved_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(alertId);

    logger.info(`[OpsAlert] Resolved alert ${alertId}`);
    return { success: true };
  } catch (error) {
    logger.error('[OpsAlert] Failed to resolve alert:', error.message);
    return { success: false, error: error.message };
  }
}

export async function acknowledgeAlert(alertId) {
  try {
    await db.prepare(`
      UPDATE ops_alerts SET status = 'acknowledged' WHERE id = ? AND status = 'open'
    `).run(alertId);

    return { success: true };
  } catch (error) {
    logger.error('[OpsAlert] Failed to acknowledge alert:', error.message);
    return { success: false, error: error.message };
  }
}

export async function getAlertStats() {
  try {
    const stats = await db.prepare(`
      SELECT 
        status,
        severity,
        type,
        COUNT(*) as count
      FROM ops_alerts
      WHERE created_at > NOW() - INTERVAL '24 hours'
      GROUP BY status, severity, type
    `).all();

    const totalOpen = await db.prepare(`
      SELECT COUNT(*) as count FROM ops_alerts WHERE status = 'open'
    `).get();

    const critical = await db.prepare(`
      SELECT COUNT(*) as count FROM ops_alerts 
      WHERE status = 'open' AND severity = 'critical'
    `).get();

    return {
      totalOpen: totalOpen?.count || 0,
      critical: critical?.count || 0,
      byStatus: stats.filter(s => s.status).reduce((acc, s) => {
        acc[s.status] = (acc[s.status] || 0) + s.count;
        return acc;
      }, {}),
      bySeverity: stats.filter(s => s.severity).reduce((acc, s) => {
        acc[s.severity] = (acc[s.severity] || 0) + s.count;
        return acc;
      }, {}),
    };
  } catch (error) {
    logger.error('[OpsAlert] Failed to get stats:', error.message);
    return { totalOpen: 0, critical: 0, byStatus: {}, bySeverity: {} };
  }
}

export default {
  createOpsAlert,
  createDeliveryFailureAlert,
  createProviderOutageAlert,
  getOpenAlerts,
  resolveAlert,
  acknowledgeAlert,
  getAlertStats,
};

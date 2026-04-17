import db from '../db.js';

export async function purgeExpiredSoftDeletedAccounts() {
  const users = await db.prepare(`
    SELECT id
    FROM users
    WHERE deleted_at IS NOT NULL AND deleted_at < (CURRENT_TIMESTAMP - INTERVAL '30 days')
  `).all();
  for (const user of users) {
    await db.prepare('DELETE FROM users WHERE id = ?').run(user.id);
  }
  return { purged: users.length };
}


import db from '../db.js';
import logger from './logger.js';

const ALLOWED_TABLES = new Set([
  'users',
  'profiles',
  'trips',
  'activities',
  'budget_entries',
  'budgets',
  'budget_items',
  'journal_entries',
  'journal_photos',
  'travel_buddies',
  'buddy_messages',
  'buddy_conversations',
  'notifications',
  'user_settings',
  'emergency_contacts',
  'guardian_acknowledgements',
  'check_ins',
  'notification_preferences',
  'itinerary_days',
  'accommodations',
  'bookings',
  'trip_documents',
  'sessions',
  'notification_delivery_logs',
  'scheduled_check_ins',
  'resources',
  'quiz_responses',
  'quiz_results',
  'webhook_subscriptions',
  'webhook_subs',
  'push_subscriptions',
  'ai_usage',
  'trip_checklist_items',
  'trip_collaborators',
  'trip_shares',
  'buddy_requests',
  'buddy_calls',
  'buddy_blocks',
  'places'
]);

function safeTableName(tableName) {
  if (!ALLOWED_TABLES.has(tableName)) {
    throw new Error(`Table "${tableName}" is not allowed for export/deletion`);
  }
  return tableName;
}

async function tableExists(tableName) {
  const table = await db.get(
    `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = ? LIMIT 1`,
    tableName
  );
  return !!table;
}

async function tableHasColumn(tableName, columnName) {
  const column = await db.get(
    `SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = ? AND column_name = ? LIMIT 1`,
    tableName,
    columnName
  );
  return !!column;
}

async function fetchRowsByUser(tableName, userId) {
  const safeTable = safeTableName(tableName);
  if (!await tableExists(safeTable)) return [];
  if (!await tableHasColumn(safeTable, 'user_id')) return [];
  return db.all(`SELECT * FROM ${safeTable} WHERE user_id = ? ORDER BY id ASC`, userId);
}

async function fetchRowsByTrip(tableName, tripIds) {
  const safeTable = safeTableName(tableName);
  if (!tripIds.length) return [];
  if (!await tableExists(safeTable)) return [];
  if (!await tableHasColumn(safeTable, 'trip_id')) return [];
  const placeholders = tripIds.map(() => '?').join(', ');
  return db.all(`SELECT * FROM ${safeTable} WHERE trip_id IN (${placeholders}) ORDER BY id ASC`, ...tripIds);
}

export async function generateUserDataExport(userId) {
  const user = await db.get('SELECT id, email, name, role, created_at, updated_at, deleted_at FROM users WHERE id = ?', userId);
  if (!user) {
    throw new Error('User not found');
  }

  const profile = await db.get('SELECT * FROM profiles WHERE user_id = ?', userId);
  const trips = await fetchRowsByUser('trips', userId);
  const tripIds = trips.map((trip) => trip.id);
  const budgets = await fetchRowsByUser('budgets', userId);
  const budgetIds = budgets.map((budget) => budget.id);

  const budgetItems = budgetIds.length
    ? await db.all(`SELECT * FROM budget_items WHERE budget_id IN (${budgetIds.map(() => '?').join(', ')}) ORDER BY id ASC`, ...budgetIds)
    : [];

  const conversations = await db.all(
    `SELECT * FROM buddy_conversations WHERE participant_a = ? OR participant_b = ? ORDER BY id ASC`,
    userId,
    userId
  );
  const conversationIds = conversations.map((conversation) => conversation.id);
  const messages = conversationIds.length
    ? await db.all(
      `SELECT * FROM buddy_messages WHERE conversation_id IN (${conversationIds.map(() => '?').join(', ')}) OR sender_id = ? ORDER BY id ASC`,
      ...conversationIds,
      userId
    )
    : await db.all('SELECT * FROM buddy_messages WHERE sender_id = ? ORDER BY id ASC', userId);

  const exportPayload = {
    metadata: {
      generated_at: new Date().toISOString(),
      gdpr_request_due_at: new Date(Date.now() + (30 * 24 * 60 * 60 * 1000)).toISOString(),
      format: 'json'
    },
    account: {
      user,
      profile
    },
    users: [user],
    trips,
    itinerary_items: await fetchRowsByTrip('activities', tripIds),
    expenses: await fetchRowsByUser('budget_entries', userId),
    budgets,
    journal_entries: await fetchRowsByUser('journal_entries', userId),
    journal_photos: await fetchRowsByUser('journal_photos', userId),
    buddy_connections: await fetchRowsByUser('travel_buddies', userId),
    messages,
    notifications: await fetchRowsByUser('notifications', userId),
    user_settings: await fetchRowsByUser('user_settings', userId),
    emergency_contacts: await fetchRowsByUser('emergency_contacts', userId),
    sos_alerts: await db.all(
      `SELECT * FROM check_ins WHERE user_id = ? AND type IN ('emergency', 'checkin_sos') ORDER BY id ASC`,
      userId
    ),
    guardian_acknowledgements: await fetchRowsByUser('guardian_acknowledgements', userId),
    check_ins: await fetchRowsByUser('check_ins', userId),
    notification_preferences: await fetchRowsByUser('notification_preferences', userId),
    itinerary_days: await fetchRowsByTrip('itinerary_days', tripIds),
    accommodations: await fetchRowsByTrip('accommodations', tripIds),
    bookings: await fetchRowsByTrip('bookings', tripIds),
    trip_documents: await fetchRowsByTrip('trip_documents', tripIds),
    budget_items: budgetItems,
    buddy_conversations: conversations
  };

  return exportPayload;
}

async function deleteByUserId(tx, tableName, userId) {
  const safeTable = safeTableName(tableName);
  if (!await tableExists(safeTable)) return;
  if (!await tableHasColumn(safeTable, 'user_id')) return;
  await tx.run(`DELETE FROM ${safeTable} WHERE user_id = ?`, userId);
}

async function deleteByTripIds(tx, tableName, tripIds) {
  const safeTable = safeTableName(tableName);
  if (!tripIds.length) return;
  if (!await tableExists(safeTable)) return;
  if (!await tableHasColumn(safeTable, 'trip_id')) return;
  const placeholders = tripIds.map(() => '?').join(', ');
  await tx.run(`DELETE FROM ${safeTable} WHERE trip_id IN (${placeholders})`, ...tripIds);
}

export async function deleteUserAccountCascade(userId) {
  await db.transaction(async (tx) => {
    const tripRows = await tx.query('SELECT id FROM trips WHERE user_id = ?', userId);
    const tripIds = tripRows.map((trip) => trip.id);

    if (tripIds.length) {
      const placeholders = tripIds.map(() => '?').join(', ');

      await tx.run(`DELETE FROM buddy_messages WHERE conversation_id IN (SELECT id FROM buddy_conversations WHERE trip_id IN (${placeholders}))`, ...tripIds);
      await tx.run(`DELETE FROM budget_items WHERE budget_id IN (SELECT id FROM budgets WHERE trip_id IN (${placeholders}))`, ...tripIds);
      await deleteByTripIds(tx, 'activities', tripIds);
      await deleteByTripIds(tx, 'itinerary_days', tripIds);
      await deleteByTripIds(tx, 'accommodations', tripIds);
      await deleteByTripIds(tx, 'bookings', tripIds);
      await deleteByTripIds(tx, 'places', tripIds);
      await deleteByTripIds(tx, 'trip_documents', tripIds);
      await deleteByTripIds(tx, 'trip_collaborators', tripIds);
      await deleteByTripIds(tx, 'trip_shares', tripIds);
      await deleteByTripIds(tx, 'budget_entries', tripIds);
      await deleteByTripIds(tx, 'buddy_requests', tripIds);
      await deleteByTripIds(tx, 'trip_checklist_items', tripIds);
    }

    await tx.run('DELETE FROM buddy_messages WHERE sender_id = ?', userId);
    await tx.run('DELETE FROM buddy_calls WHERE caller_id = ? OR receiver_id = ?', userId, userId);
    await tx.run('DELETE FROM buddy_conversations WHERE participant_a = ? OR participant_b = ?', userId, userId);
    await tx.run('DELETE FROM buddy_blocks WHERE blocker_id = ? OR blocked_id = ?', userId, userId);
    await tx.run('DELETE FROM buddy_requests WHERE sender_id = ? OR receiver_id = ?', userId, userId);

    await deleteByUserId(tx, 'sessions', userId);
    await deleteByUserId(tx, 'notifications', userId);
    await deleteByUserId(tx, 'notification_preferences', userId);
    await deleteByUserId(tx, 'notification_delivery_logs', userId);
    await deleteByUserId(tx, 'emergency_contacts', userId);
    await deleteByUserId(tx, 'guardian_acknowledgements', userId);
    await deleteByUserId(tx, 'check_ins', userId);
    await deleteByUserId(tx, 'scheduled_check_ins', userId);
    await deleteByUserId(tx, 'travel_buddies', userId);
    await deleteByUserId(tx, 'resources', userId);
    await deleteByUserId(tx, 'quiz_responses', userId);
    await deleteByUserId(tx, 'quiz_results', userId);
    await deleteByUserId(tx, 'budgets', userId);
    await deleteByUserId(tx, 'budget_entries', userId);
    await deleteByUserId(tx, 'trip_documents', userId);
    await deleteByUserId(tx, 'webhook_subscriptions', userId);
    await deleteByUserId(tx, 'webhook_subs', userId);
    await deleteByUserId(tx, 'push_subscriptions', userId);
    await deleteByUserId(tx, 'ai_usage', userId);
    await deleteByUserId(tx, 'trip_checklist_items', userId);

    await tx.run('DELETE FROM profiles WHERE user_id = ?', userId);
    await tx.run('DELETE FROM users WHERE id = ?', userId);
  });

  logger.info(`[Account] User ${userId} and related data deleted`);
}

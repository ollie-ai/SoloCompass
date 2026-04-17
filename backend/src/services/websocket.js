import { WebSocketServer } from 'ws';
import jwt from 'jsonwebtoken';
import logger from '../services/logger.js';
import db from '../db.js';
import { getJWTSecret } from '../middleware/auth.js';

let wss = null;
const userClients = new Map();

export function initWebSocketServer(server) {
  wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws, req) => {
    ws.isAlive = true;

    ws.on('pong', () => {
      ws.isAlive = true;
    });

    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString());

        if (message.type === 'auth') {
          const token = message.token;
          if (!token) {
            ws.send(JSON.stringify({ type: 'error', message: 'Token required' }));
            return;
          }

          try {
            const secret = getJWTSecret();
            if (!secret) {
              ws.send(JSON.stringify({ type: 'error', message: 'Server not configured' }));
              return;
            }
            const decoded = jwt.verify(token, secret);
            ws.userId = decoded.userId;

            if (!userClients.has(decoded.userId)) {
              userClients.set(decoded.userId, new Set());
            }
            userClients.get(decoded.userId).add(ws);

            ws.send(JSON.stringify({ type: 'authenticated', userId: decoded.userId }));
            logger.info(`[WebSocket] User ${decoded.userId} connected`);
          } catch (err) {
            ws.send(JSON.stringify({ type: 'error', message: 'Invalid token' }));
            ws.close();
          }
        }

        if (message.type === 'checkin_confirm') {
          await handleCheckinConfirm(ws.userId, message.scheduledCheckInId);
        }

        if (message.type === 'call_invite') {
          await handleCallInvite(ws.userId, message);
        }

        if (message.type === 'call_accept') {
          await handleCallAccept(ws.userId, message.callId);
        }

        if (message.type === 'call_decline') {
          await handleCallDecline(ws.userId, message.callId);
        }

        if (message.type === 'call_end') {
          await handleCallEnd(ws.userId, message.callId);
        }

        // Settings sync across devices (P3)
        if (message.type === 'settings_update') {
          handleSettingsSync(ws.userId, ws, message);
        }
      } catch (err) {
        logger.error(`[WebSocket] Message error: ${err.message}`);
      }
    });

    ws.on('close', () => {
      if (ws.userId) {
        const clients = userClients.get(ws.userId);
        if (clients) {
          clients.delete(ws);
          if (clients.size === 0) {
            userClients.delete(ws.userId);
          }
        }
        logger.info(`[WebSocket] User ${ws.userId} disconnected`);
      }
    });

    ws.on('error', (err) => {
      logger.error(`[WebSocket] Connection error: ${err.message}`);
    });
  });

  const heartbeat = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (ws.isAlive === false) {
        if (ws.userId) {
          const clients = userClients.get(ws.userId);
          if (clients) {
            clients.delete(ws);
            if (clients.size === 0) {
              userClients.delete(ws.userId);
            }
          }
        }
        return ws.terminate();
      }
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  wss.on('close', () => {
    clearInterval(heartbeat);
  });

  logger.info('[WebSocket] Server initialized on /ws');
  return wss;
}

export function broadcastToUser(userId, message) {
  const clients = userClients.get(userId);
  if (!clients || clients.size === 0) return;

  const payload = JSON.stringify(message);
  clients.forEach((ws) => {
    if (ws.readyState === 1) {
      ws.send(payload);
    }
  });
}

export function broadcastToUsers(userIds, message) {
  userIds.forEach((userId) => broadcastToUser(userId, message));
}

/**
 * Settings sync across devices (P3)
 * When a user updates settings on one device, broadcast to all other connected devices
 */
function handleSettingsSync(userId, senderWs, message) {
  const clients = userClients.get(userId);
  if (!clients || clients.size <= 1) return;

  const payload = JSON.stringify({
    type: 'settings_sync',
    section: message.section, // e.g. 'privacy', 'units', 'notifications', 'accessibility'
    data: message.data,
    updatedAt: new Date().toISOString(),
  });

  clients.forEach((ws) => {
    // Send to all devices EXCEPT the one that made the change
    if (ws !== senderWs && ws.readyState === 1) {
      ws.send(payload);
    }
  });

  logger.info(`[WebSocket] Settings sync broadcast for user ${userId} (section: ${message.section})`);
}

/**
 * Broadcast a settings change to all user devices (called from API routes)
 */
export function broadcastSettingsUpdate(userId, section, data) {
  broadcastToUser(userId, {
    type: 'settings_sync',
    section,
    data,
    updatedAt: new Date().toISOString(),
  });
}

async function handleCheckinConfirm(userId, scheduledCheckInId) {
  try {
    const sci = await db.prepare(`
      SELECT * FROM scheduled_check_ins WHERE id = ? AND user_id = ?
    `).get(scheduledCheckInId, userId);

    if (!sci) return;

    await db.prepare(`
      UPDATE scheduled_check_ins 
      SET is_active = false, missed_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ?
    `).run(scheduledCheckInId, userId);

    await db.prepare(`
      INSERT INTO check_ins (user_id, trip_id, type, status, message)
      VALUES (?, ?, 'scheduled', 'confirmed', 'User confirmed via real-time prompt')
    `).run(userId, sci.trip_id);

    if (sci.recurrence && sci.recurrence_end) {
      const nextTime = getNextRecurrenceTime(sci.scheduled_time, sci.recurrence);
      if (nextTime && new Date(nextTime) <= new Date(sci.recurrence_end)) {
        await db.prepare(`
          INSERT INTO scheduled_check_ins (user_id, trip_id, scheduled_time, timezone, is_active, recurrence, recurrence_end)
          VALUES (?, ?, ?, ?, true, ?, ?)
        `).run(userId, sci.trip_id, nextTime, sci.timezone, sci.recurrence, sci.recurrence_end);
      }
    }

    broadcastToUser(userId, {
      type: 'checkin_confirmed',
      scheduledCheckInId,
      message: 'Check-in confirmed!'
    });
  } catch (err) {
    logger.error(`[WebSocket] Check-in confirm error: ${err.message}`);
  }
}

function getNextRecurrenceTime(currentTime, recurrence) {
  const date = new Date(currentTime);
  switch (recurrence) {
    case 'hourly':
      date.setHours(date.getHours() + 1);
      break;
    case 'daily':
      date.setDate(date.getDate() + 1);
      break;
    case 'weekly':
      date.setDate(date.getDate() + 7);
      break;
    default:
      return null;
  }
  return date.toISOString();
}

export function getWebSocketServer() {
  return wss;
}

export { userClients };

async function isBlockedBetweenUsers(userA, userB) {
  const blocked = await db.prepare(`
    SELECT id
    FROM buddy_blocks
    WHERE (blocker_id = ? AND blocked_id = ?)
       OR (blocker_id = ? AND blocked_id = ?)
    LIMIT 1
  `).get(userA, userB, userB, userA);
  return !!blocked;
}

async function getConversationParticipants(conversationId) {
  return db.prepare(`
    SELECT id, participant_a, participant_b
    FROM buddy_conversations
    WHERE id = ?
    LIMIT 1
  `).get(conversationId);
}

async function handleRealtimeMessageSend(userId, payload) {
  if (!userId) return;

  const conversationId = parseInt(payload?.conversationId, 10);
  const content = typeof payload?.content === 'string' ? payload.content.trim() : '';
  const messageType = payload?.messageType || 'text';

  if (!conversationId || !content) {
    return;
  }

  const conversation = await getConversationParticipants(conversationId);
  if (!conversation) return;
  if (conversation.participant_a !== userId && conversation.participant_b !== userId) return;

  const otherUserId = conversation.participant_a === userId ? conversation.participant_b : conversation.participant_a;
  if (await isBlockedBetweenUsers(userId, otherUserId)) {
    broadcastToUser(userId, {
      type: 'error',
      code: 'BLOCKED',
      message: 'Messaging is disabled for blocked users'
    });
    return;
  }

  const result = await db.prepare(`
    INSERT INTO buddy_messages (conversation_id, sender_id, content, message_type)
    VALUES (?, ?, ?, ?)
  `).run(conversationId, userId, content, messageType);

  await db.prepare(`
    UPDATE buddy_conversations
    SET last_message_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(conversationId);

  const saved = await db.prepare(`
    SELECT 
      bm.id,
      bm.conversation_id AS "conversationId",
      bm.sender_id AS "senderId",
      bm.content,
      bm.message_type AS "messageType",
      bm.is_read AS "isRead",
      bm.created_at AS "createdAt"
    FROM buddy_messages bm
    WHERE bm.id = ?
    LIMIT 1
  `).get(result.lastInsertRowid);

  broadcastToUsers([conversation.participant_a, conversation.participant_b], {
    type: 'message:received',
    conversationId,
    message: saved
  });
}

async function handleRealtimeTyping(userId, type, rawConversationId) {
  if (!userId) return;
  const conversationId = parseInt(rawConversationId, 10);
  if (!conversationId) return;

  const conversation = await getConversationParticipants(conversationId);
  if (!conversation) return;
  if (conversation.participant_a !== userId && conversation.participant_b !== userId) return;

  const otherUserId = conversation.participant_a === userId ? conversation.participant_b : conversation.participant_a;
  if (await isBlockedBetweenUsers(userId, otherUserId)) return;

  broadcastToUser(otherUserId, {
    type,
    conversationId,
    userId
  });
}

async function handleCallInvite(userId, message) {
  try {
    const { receiverId, callType, conversationId } = message;
    
    const call = await db.prepare(`
      INSERT INTO buddy_calls (caller_id, receiver_id, conversation_id, call_type, status)
      VALUES (?, ?, ?, ?, 'pending')
      RETURNING id
    `).run(userId, receiverId, conversationId || null, callType || 'video');

    broadcastToUser(receiverId, {
      type: 'call_invite',
      call: {
        id: call.rows[0].id,
        callerId: userId,
        callType: callType || 'video',
        conversationId: conversationId
      }
    });
  } catch (err) {
    logger.error(`[WebSocket] Call invite error: ${err.message}`);
  }
}

async function handleCallAccept(userId, callId) {
  try {
    await db.prepare(`
      UPDATE buddy_calls 
      SET status = 'accepted', started_at = CURRENT_TIMESTAMP
      WHERE id = ? AND receiver_id = ? AND status = 'pending'
    `).run(callId, userId);

    const call = await db.prepare(`
      SELECT caller_id FROM buddy_calls WHERE id = ?
    `).get(callId);

    if (call) {
      broadcastToUser(call.caller_id, {
        type: 'call_accept',
        callId: parseInt(callId),
        userId: userId
      });
    }
  } catch (err) {
    logger.error(`[WebSocket] Call accept error: ${err.message}`);
  }
}

async function handleCallDecline(userId, callId) {
  try {
    await db.prepare(`
      UPDATE buddy_calls 
      SET status = 'declined', ended_at = CURRENT_TIMESTAMP
      WHERE id = ? AND receiver_id = ? AND status = 'pending'
    `).run(callId, userId);

    const call = await db.prepare(`
      SELECT caller_id FROM buddy_calls WHERE id = ?
    `).get(callId);

    if (call) {
      broadcastToUser(call.caller_id, {
        type: 'call_decline',
        callId: parseInt(callId),
        userId: userId
      });
    }
  } catch (err) {
    logger.error(`[WebSocket] Call decline error: ${err.message}`);
  }
}

async function handleCallEnd(userId, callId) {
  try {
    await db.prepare(`
      UPDATE buddy_calls 
      SET status = 'ended', ended_at = CURRENT_TIMESTAMP
      WHERE id = ? AND (caller_id = ? OR receiver_id = ?)
      AND status = 'accepted'
    `).run(callId, userId, userId);

    const call = await db.prepare(`
      SELECT caller_id, receiver_id FROM buddy_calls WHERE id = ?
    `).get(callId);

    if (call) {
      const otherUserId = call.caller_id === userId ? call.receiver_id : call.caller_id;
      broadcastToUser(otherUserId, {
        type: 'call_end',
        callId: parseInt(callId),
        userId: userId
      });
    }
  } catch (err) {
    logger.error(`[WebSocket] Call end error: ${err.message}`);
  }
}

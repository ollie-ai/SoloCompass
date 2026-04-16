import express from 'express';
import { authenticate } from '../middleware/auth.js';
import db from '../db.js';
import logger from '../services/logger.js';
import { broadcastToUser } from '../services/websocket.js';
import { createNotification } from '../services/notificationService.js';
import * as pushService from '../services/pushService.js';

const router = express.Router();
router.use(authenticate);

router.get('/conversations', async (req, res) => {
  try {
    const userId = req.userId;

    const conversations = await db.prepare(`
      SELECT 
        c.id,
        c.trip_id as "tripId",
        c.last_message_at as "lastMessageAt",
        CASE 
          WHEN c.participant_a = ? THEN c.participant_b 
          ELSE c.participant_a 
        END as "participantId",
        COALESCE(
          (SELECT content FROM buddy_messages 
           WHERE conversation_id = c.id 
           ORDER BY created_at DESC LIMIT 1), 
          NULL
        ) as "lastMessage",
        (
          SELECT COUNT(*)::int FROM buddy_messages bm
          WHERE bm.conversation_id = c.id 
          AND bm.sender_id != ?
          AND bm.is_read = FALSE
        ) as "unreadCount"
      FROM buddy_conversations c
      WHERE c.participant_a = ? OR c.participant_b = ?
      ORDER BY c.last_message_at DESC
    `).all(userId, userId, userId, userId);

    for (let conv of conversations) {
      const participant = await db.prepare(`
        SELECT u.id, u.name, u.email, p.avatar_url, p.display_name
        FROM users u
        LEFT JOIN profiles p ON u.id = p.user_id
        WHERE u.id = ?
      `).get(conv.participantId);

      let trip = null;
      if (conv.tripId) {
        trip = await db.prepare(`
          SELECT id, name, destination, start_date, end_date
          FROM trips WHERE id = ?
        `).get(conv.tripId);
      }

      conv.participant = participant;
      conv.trip = trip;
      delete conv.participantId;
      delete conv.tripId;
    }

    res.json({ success: true, data: conversations });
  } catch (error) {
    logger.error(`[Messages] Failed to list conversations: ${error.message}`);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to list conversations' }
    });
  }
});

router.get('/conversations/:conversationId', async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.userId;

    const conversation = await db.prepare(`
      SELECT id, participant_a, participant_b, trip_id
      FROM buddy_conversations WHERE id = ?
    `).get(conversationId);

    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Conversation not found' }
      });
    }

    if (conversation.participant_a !== userId && conversation.participant_b !== userId) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Not a participant in this conversation' }
      });
    }

    const messages = await db.prepare(`
      SELECT 
        bm.id,
        bm.sender_id as "senderId",
        u.name as "senderName",
        bm.content,
        bm.message_type as "messageType",
        bm.is_read as "isRead",
        bm.is_read as "read",
        bm.created_at as "createdAt"
      FROM buddy_messages bm
      JOIN users u ON bm.sender_id = u.id
      WHERE bm.conversation_id = ?
      ORDER BY bm.created_at ASC
    `).all(conversationId);

    res.json({ success: true, data: messages });
  } catch (error) {
    logger.error(`[Messages] Failed to get conversation: ${error.message}`);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to get conversation' }
    });
  }
});

router.post('/conversations', async (req, res) => {
  try {
    const { participantId, tripId } = req.body;
    const userId = req.userId;

    if (!participantId) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_FIELD', message: 'participantId is required' }
      });
    }

    if (participantId === userId) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_REQUEST', message: 'Cannot create conversation with yourself' }
      });
    }

    const existingConv = await db.prepare(`
      SELECT id FROM buddy_conversations
      WHERE (
        (participant_a = ? AND participant_b = ?)
        OR (participant_a = ? AND participant_b = ?)
      )
      ${tripId ? 'AND trip_id = ?' : ''}
      LIMIT 1
    `).get(
      tripId ? userId : userId, 
      tripId ? participantId : participantId,
      tripId ? participantId : userId,
      tripId ? userId : participantId,
      tripId || null
    );

    if (existingConv) {
      return res.json({ success: true, data: { conversationId: existingConv.id } });
    }

    const result = await db.prepare(`
      INSERT INTO buddy_conversations (participant_a, participant_b, trip_id)
      VALUES (?, ?, ?)
    `).run(
      Math.min(userId, participantId),
      Math.max(userId, participantId),
      tripId || null
    );

    res.json({ success: true, data: { conversationId: result.lastInsertRowid } });
  } catch (error) {
    logger.error(`[Messages] Failed to create conversation: ${error.message}`);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to create conversation' }
    });
  }
});

router.post('/conversations/:conversationId', async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { content, messageType = 'text' } = req.body;
    const userId = req.userId;

    if (!content || content.trim() === '') {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_FIELD', message: 'content is required' }
      });
    }

    const conversation = await db.prepare(`
      SELECT id, participant_a, participant_b
      FROM buddy_conversations WHERE id = ?
    `).get(conversationId);

    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Conversation not found' }
      });
    }

    if (conversation.participant_a !== userId && conversation.participant_b !== userId) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Not a participant in this conversation' }
      });
    }

    // Guardian plan enforcement: Explorer users are limited to 20 messages per conversation.
    // Guardian+ users have unlimited messaging.
    const sender = await db.prepare(`
      SELECT subscription_tier FROM users WHERE id = ?
    `).get(userId);
    const tier = (sender?.subscription_tier || 'explorer').toLowerCase();
    const EXPLORER_MESSAGE_LIMIT = 20;
    if (tier === 'explorer') {
      const msgCount = await db.prepare(`
        SELECT COUNT(*) AS cnt FROM buddy_messages WHERE conversation_id = ? AND sender_id = ?
      `).get(conversationId, userId);
      if (msgCount.cnt >= EXPLORER_MESSAGE_LIMIT) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'MESSAGE_LIMIT_REACHED',
            message: `Explorer plan allows up to ${EXPLORER_MESSAGE_LIMIT} messages per conversation. Upgrade to Guardian or Navigator for unlimited messaging.`,
            upgradeRequired: true,
          },
        });
      }
    }

    const result = await db.prepare(`
      INSERT INTO buddy_messages (conversation_id, sender_id, content, message_type)
      VALUES (?, ?, ?, ?)
    `).run(conversationId, userId, content.trim(), messageType);

    await db.prepare(`
      UPDATE buddy_conversations 
      SET last_message_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(conversationId);

    const message = await db.prepare(`
      SELECT 
        bm.id,
        bm.sender_id as "senderId",
        u.name as "senderName",
        bm.content,
        bm.message_type as "messageType",
        bm.is_read as "isRead",
        bm.is_read as "read",
        bm.created_at as "createdAt"
      FROM buddy_messages bm
      JOIN users u ON bm.sender_id = u.id
      WHERE bm.id = ?
    `).get(result.lastInsertRowid);

    const recipientId = conversation.participant_a === userId
      ? conversation.participant_b
      : conversation.participant_a;

    broadcastToUser(recipientId, {
      type: 'buddy_message_new',
      conversationId: parseInt(conversationId, 10),
      message
    });

    await createNotification(
      recipientId,
      'buddy_message',
      'New buddy message',
      `${message.senderName || 'A traveler'} sent you a message`,
      {
        conversationId: parseInt(conversationId, 10),
        senderId: userId,
        messageId: message.id
      }
    );

    await pushService.sendPushNotification(recipientId, {
      title: 'New buddy message',
      body: `${message.senderName || 'A traveler'}: ${message.content}`,
      data: {
        type: 'buddy_message',
        conversationId: String(conversationId),
        messageId: String(message.id)
      },
      tag: `buddy-message-${conversationId}`
    });

    res.json({ success: true, data: message });
  } catch (error) {
    logger.error(`[Messages] Failed to send message: ${error.message}`);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to send message' }
    });
  }
});

const markConversationRead = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.userId;

    const conversation = await db.prepare(`
      SELECT id, participant_a, participant_b
      FROM buddy_conversations WHERE id = ?
    `).get(conversationId);

    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Conversation not found' }
      });
    }

    if (conversation.participant_a !== userId && conversation.participant_b !== userId) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Not a participant in this conversation' }
      });
    }

    await db.prepare(`
      UPDATE buddy_messages 
      SET is_read = TRUE 
      WHERE conversation_id = ? 
      AND sender_id != ?
      AND is_read = FALSE
    `).run(conversationId, userId);

    res.json({ success: true, data: { markedRead: true } });
  } catch (error) {
    logger.error(`[Messages] Failed to mark as read: ${error.message}`);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to mark as read' }
    });
  }
};

router.put('/conversations/:conversationId/read', markConversationRead);
router.post('/conversations/:conversationId/read', markConversationRead);

router.delete('/conversations/:conversationId', async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.userId;

    const conversation = await db.prepare(`
      SELECT id, participant_a, participant_b
      FROM buddy_conversations WHERE id = ?
    `).get(conversationId);

    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Conversation not found' }
      });
    }

    if (conversation.participant_a !== userId && conversation.participant_b !== userId) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Not a participant in this conversation' }
      });
    }

    await db.prepare(`
      DELETE FROM buddy_messages WHERE conversation_id = ?
    `).run(conversationId);

    await db.prepare(`
      DELETE FROM buddy_conversations WHERE id = ?
    `).run(conversationId);

    res.json({ success: true, data: { deleted: true } });
  } catch (error) {
    logger.error(`[Messages] Failed to delete conversation: ${error.message}`);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to delete conversation' }
    });
  }
});

// ------------------------------------------------------------------
// connectionId-based message routes for /api/v1/buddy/messages/:connectionId
// These resolve the accepted buddy_request (connection) to its conversation.
// ------------------------------------------------------------------

async function resolveConversationFromConnection(connectionId, userId) {
  const connection = await db.prepare(`
    SELECT id, sender_id, receiver_id
    FROM buddy_requests
    WHERE id = ?
      AND status = 'accepted'
      AND (sender_id = ? OR receiver_id = ?)
  `).get(connectionId, userId, userId);

  if (!connection) return null;

  const otherId = connection.sender_id === userId ? connection.receiver_id : connection.sender_id;

  let conversation = await db.prepare(`
    SELECT id FROM buddy_conversations
    WHERE (participant_a = ? AND participant_b = ?)
       OR (participant_a = ? AND participant_b = ?)
    LIMIT 1
  `).get(Math.min(userId, otherId), Math.max(userId, otherId),
         Math.max(userId, otherId), Math.min(userId, otherId));

  if (!conversation) {
    const result = await db.prepare(`
      INSERT INTO buddy_conversations (participant_a, participant_b)
      VALUES (?, ?)
    `).run(Math.min(userId, otherId), Math.max(userId, otherId));
    conversation = { id: result.lastInsertRowid };
  }

  return conversation.id;
}

router.get('/connection/:connectionId', async (req, res) => {
  try {
    const { connectionId } = req.params;
    const userId = req.userId;

    const conversationId = await resolveConversationFromConnection(parseInt(connectionId, 10), userId);
    if (!conversationId) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Connection not found' } });
    }

    req.params.conversationId = String(conversationId);
    return router.handle(Object.assign(req, { url: `/conversations/${conversationId}`, path: `/conversations/${conversationId}` }), res);
  } catch (error) {
    logger.error(`[Messages] connectionId GET failed: ${error.message}`);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to get messages' } });
  }
});

router.post('/connection/:connectionId', async (req, res) => {
  try {
    const { connectionId } = req.params;
    const userId = req.userId;

    const conversationId = await resolveConversationFromConnection(parseInt(connectionId, 10), userId);
    if (!conversationId) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Connection not found' } });
    }

    req.params.conversationId = String(conversationId);
    return router.handle(Object.assign(req, { url: `/conversations/${conversationId}`, path: `/conversations/${conversationId}` }), res);
  } catch (error) {
    logger.error(`[Messages] connectionId POST failed: ${error.message}`);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to send message' } });
  }
});

export default router;

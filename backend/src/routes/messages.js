import express from 'express';
import { authenticate } from '../middleware/auth.js';
import db from '../db.js';
import logger from '../services/logger.js';

const router = express.Router();
router.use(authenticate);

const isBlockedBetweenUsers = async (userA, userB) => {
  const blocked = await db.prepare(`
    SELECT id
    FROM buddy_blocks
    WHERE (blocker_id = ? AND blocked_id = ?)
       OR (blocker_id = ? AND blocked_id = ?)
    LIMIT 1
  `).get(userA, userB, userB, userA);
  return !!blocked;
};

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

    if (await isBlockedBetweenUsers(userId, participantId)) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Messaging is disabled for blocked users' }
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

    const otherUserId = conversation.participant_a === userId ? conversation.participant_b : conversation.participant_a;
    if (await isBlockedBetweenUsers(userId, otherUserId)) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Messaging is disabled for blocked users' }
      });
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
        bm.created_at as "createdAt"
      FROM buddy_messages bm
      JOIN users u ON bm.sender_id = u.id
      WHERE bm.id = ?
    `).get(result.lastInsertRowid);

    res.json({ success: true, data: message });
  } catch (error) {
    logger.error(`[Messages] Failed to send message: ${error.message}`);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to send message' }
    });
  }
});

router.put('/conversations/:conversationId/read', async (req, res) => {
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
});

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

export default router;

import express from 'express';
import db from '../db.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { sendVerificationSMS } from '../services/smsService.js';
import { PLAN_TIERS } from '../middleware/paywall.js';
import logger from '../services/logger.js';

const TIER_CONTACT_LIMITS = {
  [PLAN_TIERS.EXPLORER]: 1,
  [PLAN_TIERS.GUARDIAN]: 3,
  [PLAN_TIERS.NAVIGATOR]: 5
};

async function getUserTier(userId) {
  const user = await db.prepare('SELECT subscription_tier, is_premium FROM users WHERE id = ?').get(userId);
  if (!user) return PLAN_TIERS.EXPLORER;
  if (user.is_premium && !user.subscription_tier) return PLAN_TIERS.GUARDIAN;
  return user.subscription_tier || PLAN_TIERS.EXPLORER;
}

const RELATIONSHIPS = ['parent', 'spouse', 'sibling', 'friend', 'partner', 'other'];

const router = express.Router();

// GET /emergency-contacts - List user's emergency contacts (admin can view any user's)
router.get('/', authenticate, async (req, res) => {
  try {
    const targetUserId = req.userRole === 'admin' && req.query.user_id ? parseInt(req.query.user_id) : req.userId;
    
    const contacts = await db.prepare(`
      SELECT id, user_id, name, phone, email, relationship, is_primary, created_at FROM emergency_contacts WHERE user_id = ? 
      ORDER BY is_primary DESC, created_at ASC
    `).all(targetUserId);

    const formattedContacts = contacts.map(c => ({
      id: c.id,
      userId: c.user_id,
      name: c.name,
      email: c.email,
      phone: c.phone,
      relationship: c.relationship,
      isPrimary: Boolean(c.is_primary),
      notifyOnCheckin: Boolean(c.notify_on_checkin),
      notifyOnEmergency: Boolean(c.notify_on_emergency),
      preferEmail: c.prefer_email !== false,
      preferSms: Boolean(c.prefer_sms),
      deliveryOrder: c.delivery_order || 'email_first',
      verified: Boolean(c.verified),
      createdAt: c.created_at,
      updatedAt: c.updated_at
    }));

    res.json({
      success: true,
      data: { contacts: formattedContacts }
    });
  } catch (error) {
    logger.error('Error fetching emergency contacts:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch emergency contacts' });
  }
});

// GET /emergency-contacts/:id - Get single contact
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    const contact = await db.prepare(`
      SELECT id, user_id, name, phone, email, relationship, is_primary, created_at FROM emergency_contacts WHERE id = ? AND user_id = ?
    `).get(id, req.userId);

    if (!contact) {
      return res.status(404).json({ success: false, error: 'Contact not found' });
    }

    res.json({
      success: true,
      data: {
        id: contact.id,
        userId: contact.user_id,
        name: contact.name,
        email: contact.email,
        phone: contact.phone,
        relationship: contact.relationship,
        isPrimary: Boolean(contact.is_primary),
        notifyOnCheckin: Boolean(contact.notify_on_checkin),
        notifyOnEmergency: Boolean(contact.notify_on_emergency),
        preferEmail: contact.prefer_email !== false,
        preferSms: Boolean(contact.prefer_sms),
        deliveryOrder: contact.delivery_order || 'email_first',
        createdAt: contact.created_at,
        updatedAt: contact.updated_at
      }
    });
  } catch (error) {
    logger.error('Error fetching emergency contact:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch emergency contact' });
  }
});

// POST /emergency-contacts - Create new contact
router.post('/', authenticate, async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      relationship = 'friend',
      isPrimary = false,
      notifyOnCheckin = true,
      notifyOnEmergency = true,
      preferEmail = true,
      preferSms = false,
      deliveryOrder = 'email_first'
    } = req.body;

    // Validation
    if (!name) {
      return res.status(400).json({ 
        success: false, 
        error: 'Name is required' 
      });
    }

    if (!email && !phone) {
      return res.status(400).json({ 
        success: false, 
        error: 'At least email or phone is required' 
      });
    }

    if (relationship && !RELATIONSHIPS.includes(relationship)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid relationship type' 
      });
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid email format'
      });
    }

    if (phone && !/^[\+]?[\d\s\-\(\)]{7,20}$/.test(phone)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid phone format. Must be 7-20 digits, optionally with +, spaces, dashes, or parentheses.'
      });
    }

    // Check contact limit per tier
    const tier = await getUserTier(req.userId);
    const limit = TIER_CONTACT_LIMITS[tier] ?? 1;
    const existingCount = await db.prepare(`
      SELECT COUNT(*) as count FROM emergency_contacts WHERE user_id = ?
    `).get(req.userId);

    if (existingCount.count >= limit) {
      return res.status(400).json({ 
        success: false, 
        error: `Your plan allows up to ${limit} emergency contact${limit === 1 ? '' : 's'}. Upgrade to add more.`
      });
    }

    // If setting as primary, unset other primaries
    if (isPrimary) {
      await db.prepare(`
        UPDATE emergency_contacts SET is_primary = false WHERE user_id = ?
      `).run(req.userId);
    }

    // Insert contact
    const result = await db.prepare(`
      INSERT INTO emergency_contacts (
        user_id, name, email, phone, relationship, 
        is_primary, notify_on_checkin, notify_on_emergency,
        prefer_email, prefer_sms, delivery_order
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      req.userId,
      name,
      email || null,
      phone || null,
      relationship,
      isPrimary ? true : false,
      notifyOnCheckin ? true : false,
      notifyOnEmergency ? true : false,
      preferEmail ? true : false,
      preferSms ? true : false,
      deliveryOrder
    );

    const newContact = await db.prepare(`
      SELECT id, user_id, name, phone, email, relationship, is_primary, created_at FROM emergency_contacts WHERE id = ?
    `).get(result.lastInsertRowid);

    res.status(201).json({
      success: true,
      data: {
        id: newContact.id,
        userId: newContact.user_id,
        name: newContact.name,
        email: newContact.email,
        phone: newContact.phone,
        relationship: newContact.relationship,
        isPrimary: Boolean(newContact.is_primary),
        notifyOnCheckin: Boolean(newContact.notify_on_checkin),
        notifyOnEmergency: Boolean(newContact.notify_on_emergency),
        preferEmail: newContact.prefer_email !== false,
        preferSms: Boolean(newContact.prefer_sms),
        deliveryOrder: newContact.delivery_order || 'email_first',
        createdAt: newContact.created_at,
        updatedAt: newContact.updated_at
      }
    });
  } catch (error) {
    logger.error('Error creating emergency contact:', error);
    res.status(500).json({ success: false, error: 'Failed to create emergency contact' });
  }
});

// PUT /emergency-contacts/:id - Update contact
router.put('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      email,
      phone,
      relationship,
      isPrimary,
      notifyOnCheckin,
      notifyOnEmergency,
      preferEmail,
      preferSms,
      deliveryOrder
    } = req.body;

    // Check ownership
    const contact = await db.prepare(`
      SELECT id, user_id, name, phone, email, relationship, is_primary, created_at FROM emergency_contacts WHERE id = ? AND user_id = ?
    `).get(id, req.userId);

    if (!contact) {
      return res.status(404).json({ success: false, error: 'Contact not found' });
    }

    if (relationship && !RELATIONSHIPS.includes(relationship)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid relationship type' 
      });
    }

    // If setting as primary, unset other primaries
    if (isPrimary && !contact.is_primary) {
      await db.prepare(`
        UPDATE emergency_contacts SET is_primary = false WHERE user_id = ?
      `).run(req.userId);
    }

    // Build update query
    const updates = [];
    const params = [];

    if (name !== undefined) {
      updates.push('name = ?');
      params.push(name);
    }
    if (email !== undefined) {
      updates.push('email = ?');
      params.push(email);
    }
    if (phone !== undefined) {
      updates.push('phone = ?');
      params.push(phone);
    }
    if (relationship !== undefined) {
      updates.push('relationship = ?');
      params.push(relationship);
    }
    if (isPrimary !== undefined) {
      updates.push('is_primary = ?');
      params.push(isPrimary ? true : false);
    }
    if (notifyOnCheckin !== undefined) {
      updates.push('notify_on_checkin = ?');
      params.push(notifyOnCheckin ? true : false);
    }
    if (notifyOnEmergency !== undefined) {
      updates.push('notify_on_emergency = ?');
      params.push(notifyOnEmergency ? true : false);
    }
    if (preferEmail !== undefined) {
      updates.push('prefer_email = ?');
      params.push(preferEmail ? true : false);
    }
    if (preferSms !== undefined) {
      updates.push('prefer_sms = ?');
      params.push(preferSms ? true : false);
    }
    if (deliveryOrder !== undefined) {
      updates.push('delivery_order = ?');
      params.push(deliveryOrder);
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);

    await db.prepare(`
      UPDATE emergency_contacts SET ${updates.join(', ')} WHERE id = ?
    `).run(...params);

    const updated = await db.prepare(`
      SELECT id, user_id, name, phone, email, relationship, is_primary, created_at FROM emergency_contacts WHERE id = ?
    `).get(id);

    res.json({
      success: true,
      data: {
        id: updated.id,
        userId: updated.user_id,
        name: updated.name,
        email: updated.email,
        phone: updated.phone,
        relationship: updated.relationship,
        isPrimary: Boolean(updated.is_primary),
        notifyOnCheckin: Boolean(updated.notify_on_checkin),
        notifyOnEmergency: Boolean(updated.notify_on_emergency),
        preferEmail: updated.prefer_email !== false,
        preferSms: Boolean(updated.prefer_sms),
        deliveryOrder: updated.delivery_order || 'email_first',
        createdAt: updated.created_at,
        updatedAt: updated.updated_at
      }
    });
  } catch (error) {
    logger.error('Error updating emergency contact:', error);
    res.status(500).json({ success: false, error: 'Failed to update emergency contact' });
  }
});

// DELETE /emergency-contacts/:id - Delete contact
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    // Check ownership
    const contact = await db.prepare(`
      SELECT user_id FROM emergency_contacts WHERE id = ?
    `).get(id);

    if (!contact) {
      return res.status(404).json({ success: false, error: 'Contact not found' });
    }

    if (contact.user_id !== req.userId) {
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }

    await db.prepare('DELETE FROM emergency_contacts WHERE id = ?').run(id);

    res.json({ success: true, message: 'Contact deleted' });
  } catch (error) {
    logger.error('Error deleting emergency contact:', error);
    res.status(500).json({ success: false, error: 'Failed to delete emergency contact' });
  }
});

// POST /emergency-contacts/:id/test - Send test notification
router.post('/:id/test', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    // Check ownership
    const contact = await db.prepare(`
      SELECT ec.*, u.name as user_name, u.email as user_email
      FROM emergency_contacts ec
      JOIN users u ON ec.user_id = u.id
      WHERE ec.id = ? AND ec.user_id = ?
    `).get(id, req.userId);

    if (!contact) {
      return res.status(404).json({ success: false, error: 'Contact not found' });
    }

    if (!contact.email) {
      return res.status(400).json({ 
        success: false, 
        error: 'Contact has no email address' 
      });
    }

    // Send test email
    const { sendTestNotification } = await import('../services/notificationService.js');
    const result = await sendTestNotification(contact, {
      name: contact.user_name
    });

    if (!result.success) {
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to send test notification' 
      });
    }

    res.json({ success: true, message: 'Test notification sent' });
  } catch (error) {
    logger.error('Error sending test notification:', error);
    res.status(500).json({ success: false, error: 'Failed to send test notification' });
  }
});

// POST /emergency-contacts/:id/send-verification - Send SMS verification to contact
router.post('/:id/send-verification', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    const contact = await db.prepare(`
      SELECT ec.*, u.name as user_name
      FROM emergency_contacts ec
      JOIN users u ON ec.user_id = u.id
      WHERE ec.id = ? AND ec.user_id = ?
    `).get(id, req.userId);

    if (!contact) {
      return res.status(404).json({ success: false, error: 'Contact not found' });
    }

    if (!contact.phone) {
      return res.status(400).json({ 
        success: false, 
        error: 'Contact has no phone number' 
      });
    }

    const verificationCode = String(Math.floor(100000 + Math.random() * 900000));
    
    await db.prepare(`
      UPDATE emergency_contacts 
      SET verification_code = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(verificationCode, id);

    const { sendVerificationSMS } = await import('../services/smsService.js');
    const result = await sendVerificationSMS({
      phone: contact.phone,
      name: contact.name
    }, {
      name: contact.user_name
    });

    if (!result.success) {
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to send verification SMS' 
      });
    }

    res.json({ success: true, message: 'Verification SMS sent' });
  } catch (error) {
    logger.error('Error sending verification SMS:', error);
    res.status(500).json({ success: false, error: 'Failed to send verification SMS' });
  }
});

// POST /emergency-contacts/:id/verify - Verify contact with code
router.post('/:id/verify', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({ success: false, error: 'Verification code is required' });
    }

    const contact = await db.prepare(`
      SELECT id, user_id, verification_code, verified FROM emergency_contacts WHERE id = ? AND user_id = ?
    `).get(id, req.userId);

    if (!contact) {
      return res.status(404).json({ success: false, error: 'Contact not found' });
    }

    if (contact.verified) {
      return res.json({ success: true, message: 'Contact is already verified' });
    }

    if (!contact.verification_code || contact.verification_code !== String(code)) {
      return res.status(400).json({ success: false, error: 'Invalid verification code' });
    }

    await db.prepare(`
      UPDATE emergency_contacts
      SET verified = true, verification_code = NULL, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(id);

    res.json({ success: true, message: 'Contact verified successfully' });
  } catch (error) {
    logger.error('Error verifying contact:', error);
    res.status(500).json({ success: false, error: 'Failed to verify contact' });
  }
});

export default router;

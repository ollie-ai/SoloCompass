import express from 'express';
import db from '../db.js';
import logger from '../services/logger.js';

const router = express.Router();

// GET /api/v1/content/guides
router.get('/guides', async (req, res) => {
  try {
    const { category, destination, page = 1, limit = 12 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let sql = `SELECT id, slug, title, excerpt, category, tags, destination, country, cover_image, author, read_time_minutes, view_count, created_at FROM content_guides WHERE is_published = true`;
    const params = [];

    if (category) { sql += ` AND category = $${params.length + 1}`; params.push(category); }
    if (destination) {
      sql += ` AND (destination ILIKE $${params.length + 1} OR country ILIKE $${params.length + 2})`;
      params.push(`%${destination}%`, `%${destination}%`);
    }

    sql += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit), offset);

    const guides = await db.all(sql, ...params);
    const totalRow = await db.get(`SELECT COUNT(*) as count FROM content_guides WHERE is_published = true`);

    res.json({
      success: true,
      data: guides,
      pagination: { page: parseInt(page), limit: parseInt(limit), total: parseInt(totalRow?.count || 0) },
    });
  } catch (err) {
    logger.error(`[Content] List guides error: ${err.message}`);
    res.status(500).json({ success: false, error: { code: 'SC-ERR-500', message: 'Failed to list guides' } });
  }
});

// GET /api/v1/content/guides/:slug
router.get('/guides/:slug', async (req, res) => {
  try {
    const guide = await db.get(`SELECT * FROM content_guides WHERE slug = $1 AND is_published = true`, req.params.slug);
    if (!guide) return res.status(404).json({ success: false, error: { code: 'SC-ERR-404', message: 'Guide not found' } });

    await db.run(`UPDATE content_guides SET view_count = view_count + 1 WHERE id = $1`, guide.id).catch(() => {});

    res.json({ success: true, data: guide });
  } catch (err) {
    logger.error(`[Content] Get guide error: ${err.message}`);
    res.status(500).json({ success: false, error: { code: 'SC-ERR-500', message: 'Failed to get guide' } });
  }
});

// GET /api/v1/content/tips
router.get('/tips', async (req, res) => {
  try {
    const { category, difficulty, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let sql = `SELECT * FROM content_tips WHERE is_published = true`;
    const params = [];

    if (category) { sql += ` AND category = $${params.length + 1}`; params.push(category); }
    if (difficulty) { sql += ` AND difficulty = $${params.length + 1}`; params.push(difficulty); }

    sql += ` ORDER BY helpful_count DESC, created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit), offset);

    const tips = await db.all(sql, ...params);
    const totalRow = await db.get(`SELECT COUNT(*) as count FROM content_tips WHERE is_published = true`);

    res.json({
      success: true,
      data: tips,
      pagination: { page: parseInt(page), limit: parseInt(limit), total: parseInt(totalRow?.count || 0) },
    });
  } catch (err) {
    logger.error(`[Content] List tips error: ${err.message}`);
    res.status(500).json({ success: false, error: { code: 'SC-ERR-500', message: 'Failed to list tips' } });
  }
});

// GET /api/v1/content/phrases/:lang
router.get('/phrases/:lang', async (req, res) => {
  try {
    const { lang } = req.params;
    const phrases = {
      en: { help: 'Help!', emergency: 'This is an emergency', police: 'Call the police', hospital: 'I need a hospital', lost: 'I am lost', translate: 'Do you speak English?' },
      es: { help: '¡Ayuda!', emergency: 'Esta es una emergencia', police: 'Llame a la policía', hospital: 'Necesito un hospital', lost: 'Estoy perdido/a', translate: '¿Habla inglés?' },
      fr: { help: 'À l\'aide!', emergency: 'C\'est une urgence', police: 'Appelez la police', hospital: 'J\'ai besoin d\'un hôpital', lost: 'Je suis perdu(e)', translate: 'Parlez-vous anglais?' },
      de: { help: 'Hilfe!', emergency: 'Dies ist ein Notfall', police: 'Rufen Sie die Polizei', hospital: 'Ich brauche ein Krankenhaus', lost: 'Ich habe mich verirrt', translate: 'Sprechen Sie Englisch?' },
      ja: { help: '助けてください！', emergency: '緊急事態です', police: '警察を呼んでください', hospital: '病院が必要です', lost: '道に迷いました', translate: '英語を話せますか？' },
      zh: { help: '救命！', emergency: '这是紧急情况', police: '请叫警察', hospital: '我需要医院', lost: '我迷路了', translate: '你会说英语吗？' },
    };

    const langPhrases = phrases[lang.toLowerCase()] || phrases.en;
    res.json({ success: true, data: { language: lang, phrases: langPhrases } });
  } catch (err) {
    logger.error(`[Content] Phrases error: ${err.message}`);
    res.status(500).json({ success: false, error: { code: 'SC-ERR-500', message: 'Failed to get phrases' } });
  }
});

export default router;

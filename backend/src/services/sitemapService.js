import db from '../db.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from './logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE_URL = 'https://solocompass.app';

/**
 * Generates a production-ready sitemap.xml for SoloCompass.
 * This includes all static pages and dynamic destination intelligence hubs.
 */
export async function generateSitemap() {
  try {
    const staticPages = [
      '',
      '/destinations',
      '/quiz',
      '/safety',
      '/reviews',
      '/about',
      '/features',
      '/pricing',
      '/faq',
      '/changelog',
      '/help',
      '/contact',
      '/safety-info',
      '/partnerships',
      '/login',
      '/register'
    ];

    // Fetch all active destinations from the database
    const destinations = await db.prepare('SELECT id, updated_at FROM destinations').all();

    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`;

    // Add static pages
    staticPages.forEach(page => {
      xml += `
  <url>
    <loc>${BASE_URL}${page}</loc>
    <changefreq>weekly</changefreq>
    <priority>${page === '' ? '1.0' : '0.8'}</priority>
  </url>`;
    });

    // Add dynamic destination hubs
    destinations.forEach(dest => {
      const lastMod = dest.updated_at ? new Date(dest.updated_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
      xml += `
  <url>
    <loc>${BASE_URL}/destinations/${dest.id}</loc>
    <lastmod>${lastMod}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>`;
    });

    xml += `
</urlset>`;

    // Write to public folder (accessible as solocompass.app/sitemap.xml)
    const publicPath = path.join(__dirname, '..', '..', '..', 'frontend', 'public', 'sitemap.xml');
    
    // Ensure directory exists (though public should exist)
    const publicDir = path.dirname(publicPath);
    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, { recursive: true });
    }

    fs.writeFileSync(publicPath, xml);
    logger.info(`[SEO] Sitemap generated successfully with ${destinations.length} destination hubs.`);
    return true;
  } catch (error) {
    logger.error('[SEO] Sitemap generation failed:', error);
    return false;
  }
}

import fs from 'fs/promises';
import crypto from 'crypto';
import path from 'path';

const distPath = path.resolve(process.cwd(), 'dist');
const htmlPath = path.join(distPath, 'index.html');
const cacheFile = path.join(distPath, '.prerender-cache.json');

// Public routes aligned with sitemapService.js static pages plus SEO-important marketing pages
const routes = [
  {
    route: '/',
    title: 'SoloCompass — Your AI Solo Travel Companion',
    description: 'Plan safer, smarter, and more immersive solo trips with AI-powered itineraries and real-time safety data.',
    ogType: 'website',
  },
  {
    route: '/features',
    title: 'Features - SoloCompass',
    description: 'Discover how SoloCompass helps solo travelers plan safer, smarter trips with AI-powered itineraries, real-time safety alerts, and travel buddy matching.',
    ogType: 'website',
  },
  {
    route: '/help',
    title: 'Help Center - SoloCompass',
    description: 'Find support articles, FAQs, and guidance for getting the most from SoloCompass.',
    ogType: 'website',
  },
  {
    route: '/safety-info',
    title: 'Safety Information - SoloCompass',
    description: 'Learn how SoloCompass keeps solo travellers safe with check-ins, emergency tools, and real-time advisories.',
    ogType: 'website',
  },
  {
    route: '/about',
    title: 'About SoloCompass',
    description: 'Meet the team behind SoloCompass and discover our mission to make solo travel safer for everyone.',
    ogType: 'website',
  },
  {
    route: '/pricing',
    title: 'Pricing - SoloCompass',
    description: 'Choose the plan that suits your travels — from free Explorer to premium Navigator with full AI and safety features.',
    ogType: 'website',
  },
];

const BASE_URL = 'https://solocompass.app';
const OG_IMAGE = `${BASE_URL}/og-image.png`;

function hashContent(content) {
  return crypto.createHash('sha256').update(content).digest('hex').slice(0, 16);
}

async function loadCache() {
  try {
    const raw = await fs.readFile(cacheFile, 'utf8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function saveCache(cache) {
  await fs.writeFile(cacheFile, JSON.stringify(cache, null, 2), 'utf8');
}

function buildHtml(baseHtml, { route, title, description, ogType }) {
  const canonical = `${BASE_URL}${route}`;
  return baseHtml
    // Title
    .replace(/<title>.*?<\/title>/, `<title>${title}</title>`)
    // Meta description
    .replace(/<meta name="description" content=".*?" \/>/, `<meta name="description" content="${description}" />`)
    // Canonical
    .replace(/<link rel="canonical" href=".*?" \/>/, `<link rel="canonical" href="${canonical}" />`)
    // Open Graph
    .replace(/<meta property="og:url" content=".*?" \/>/, `<meta property="og:url" content="${canonical}" />`)
    .replace(/<meta property="og:title" content=".*?" \/>/, `<meta property="og:title" content="${title}" />`)
    .replace(/<meta property="og:description" content=".*?" \/>/, `<meta property="og:description" content="${description}" />`)
    .replace(/<meta property="og:type" content=".*?" \/>/, `<meta property="og:type" content="${ogType}" />`)
    .replace(/<meta property="og:image" content=".*?" \/>/, `<meta property="og:image" content="${OG_IMAGE}" />`)
    // Twitter
    .replace(/<meta property="twitter:url" content=".*?" \/>/, `<meta property="twitter:url" content="${canonical}" />`)
    .replace(/<meta property="twitter:title" content=".*?" \/>/, `<meta property="twitter:title" content="${title}" />`)
    .replace(/<meta property="twitter:description" content=".*?" \/>/, `<meta property="twitter:description" content="${description}" />`);
}

const baseHtml = await fs.readFile(htmlPath, 'utf8');
const cache = await loadCache();
let rendered = 0;
let skipped = 0;

for (const routeMeta of routes) {
  const { route } = routeMeta;
  const withMeta = buildHtml(baseHtml, routeMeta);
  const contentHash = hashContent(withMeta);

  const routeDir = path.join(distPath, route === '/' ? '' : route.slice(1));
  const outFile = path.join(routeDir, 'index.html');

  // Incremental: skip if hash matches the last render
  if (cache[route] === contentHash) {
    skipped++;
    continue;
  }

  await fs.mkdir(routeDir, { recursive: true });
  await fs.writeFile(outFile, withMeta, 'utf8');
  cache[route] = contentHash;
  rendered++;
}

await saveCache(cache);
console.log(`Prerender complete — ${rendered} rendered, ${skipped} skipped (cached).`);

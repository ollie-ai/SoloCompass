export async function trackFrontendError(error, context = {}) {
  const webhook = import.meta.env.VITE_ERROR_TRACKING_WEBHOOK_URL;
  if (!webhook) return;

  try {
    await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: 'frontend',
        message: error?.message || String(error),
        stack: error?.stack || null,
        context,
        timestamp: new Date().toISOString()
      })
    });
  } catch {
    // no-op
  }
}

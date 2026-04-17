import logger from './logger.js';

const jobs = [];
let draining = false;

const RETRY_DELAYS_MS = [60_000, 5 * 60_000, 15 * 60_000];

export function queueNotificationJob(job, { immediate = false } = {}) {
  const queueJob = {
    ...job,
    attempts: job.attempts || 0,
    runAt: immediate ? Date.now() : (job.runAt || Date.now()),
  };
  jobs.push(queueJob);
  jobs.sort((a, b) => (a.runAt - b.runAt) || ((a.priorityWeight || 99) - (b.priorityWeight || 99)));
}

export function getRetryDelayMs(attempts) {
  return RETRY_DELAYS_MS[Math.max(0, Math.min(RETRY_DELAYS_MS.length - 1, attempts - 1))];
}

export async function processNotificationQueue(handler) {
  if (draining) return;
  draining = true;
  try {
    const now = Date.now();
    while (jobs.length && jobs[0].runAt <= now) {
      const job = jobs.shift();
      try {
        await handler(job);
      } catch (error) {
        logger.error(`[NotificationQueue] Job processing failed: ${error.message}`);
      }
    }
  } finally {
    draining = false;
  }
}

setInterval(() => {
  // no-op heartbeat; dispatcher will call processNotificationQueue with handler
}, 1000).unref?.();


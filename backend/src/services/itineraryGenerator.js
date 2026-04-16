import db from '../db.js';
import { generateItinerary } from './itineraryAI.js';

function toIsoDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

function diffDaysInclusive(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 1;
  const ms = end.setHours(0, 0, 0, 0) - start.setHours(0, 0, 0, 0);
  return Math.max(1, Math.floor(ms / (24 * 60 * 60 * 1000)) + 1);
}

async function resolveDestination(destinationId) {
  if (!destinationId) return null;
  const destination = await db.prepare(`
    SELECT id, name, city, country
    FROM destinations
    WHERE id = ?
  `).get(destinationId);
  if (!destination) return null;
  return destination.name || [destination.city, destination.country].filter(Boolean).join(', ');
}

export async function generateStructuredItinerary({ destinationId, startDate, endDate, preferences = {} }) {
  const destination = await resolveDestination(destinationId);
  if (!destination) {
    throw new Error('Destination not found');
  }

  const start = toIsoDate(startDate);
  const end = toIsoDate(endDate);
  const days = diffDaysInclusive(start, end);

  const aiResult = await generateItinerary({
    destination,
    startDate: start,
    endDate: end,
    days,
    interests: preferences.interests || [],
    pace: preferences.pace || 'moderate',
    budget: preferences.budget,
    travelStyle: preferences.travelStyle || 'balanced',
    soloFriendly: true,
  });

  const normalizedDays = (aiResult?.days || []).map((day, index) => ({
    date: day.date || (start ? new Date(new Date(start).getTime() + index * 86400000).toISOString().slice(0, 10) : null),
    activities: (day.activities || []).map((activity) => ({
      time: activity.time || null,
      title: activity.title || activity.name || 'Activity',
      location: activity.location || null,
      category: activity.category || activity.type || 'general',
      duration: activity.duration || activity.duration_hours || activity.duration_minutes || null,
    })),
  }));

  return { days: normalizedDays };
}


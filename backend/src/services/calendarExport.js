/**
 * Calendar export service
 * Generates RFC-5545 .ics files for a trip's flights and itinerary events.
 */

function escapeIcs(str) {
  if (!str) return '';
  return String(str)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '');
}

function formatDtStamp(date) {
  const d = date instanceof Date ? date : new Date(date);
  return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

function buildVEvent({ uid, dtstart, dtend, summary, description, location }) {
  const lines = [
    'BEGIN:VEVENT',
    `UID:${escapeIcs(uid)}`,
    `DTSTAMP:${formatDtStamp(new Date())}`,
    `DTSTART:${formatDtStamp(dtstart)}`,
    `DTEND:${formatDtStamp(dtend)}`,
    `SUMMARY:${escapeIcs(summary)}`,
  ];
  if (description) lines.push(`DESCRIPTION:${escapeIcs(description)}`);
  if (location) lines.push(`LOCATION:${escapeIcs(location)}`);
  lines.push('END:VEVENT');
  return lines.join('\r\n');
}

/**
 * Build an .ics calendar string for a trip.
 * @param {object} trip - trip record with flights and itinerary arrays
 * @returns {string} .ics content
 */
export function buildTripCalendar(trip) {
  const events = [];

  // Add whole-trip event
  if (trip.start_date && trip.end_date) {
    events.push(buildVEvent({
      uid: `trip-${trip.id}@solocompass`,
      dtstart: new Date(trip.start_date),
      dtend: new Date(trip.end_date),
      summary: `Trip to ${trip.destination || trip.name}`,
      description: trip.description || `SoloCompass trip: ${trip.name}`,
      location: trip.destination || ''
    }));
  }

  // Add flights if provided
  if (Array.isArray(trip.flights)) {
    for (const f of trip.flights) {
      if (!f.departure?.scheduled) continue;
      const depTime = new Date(f.departure.scheduled);
      const arrTime = f.arrival?.scheduled ? new Date(f.arrival.scheduled) : new Date(depTime.getTime() + 3 * 60 * 60 * 1000);
      events.push(buildVEvent({
        uid: `flight-${f.flight_number || f.id}-${depTime.toISOString()}@solocompass`,
        dtstart: depTime,
        dtend: arrTime,
        summary: `✈ ${f.flight_number || 'Flight'}: ${f.departure?.iata || ''} → ${f.arrival?.iata || ''}`,
        description: [
          f.airline ? `Airline: ${f.airline}` : '',
          f.departure?.terminal ? `Dep. Terminal: ${f.departure.terminal}` : '',
          f.departure?.gate ? `Dep. Gate: ${f.departure.gate}` : '',
          f.arrival?.terminal ? `Arr. Terminal: ${f.arrival.terminal}` : '',
        ].filter(Boolean).join('\n'),
        location: f.departure?.airport || f.departure?.iata || ''
      }));
    }
  }

  // Add itinerary activities if provided
  if (Array.isArray(trip.activities)) {
    for (const act of trip.activities) {
      if (!act.scheduled_start) continue;
      const startTime = new Date(act.scheduled_start);
      const endTime = act.scheduled_end ? new Date(act.scheduled_end) : new Date(startTime.getTime() + 2 * 60 * 60 * 1000);
      events.push(buildVEvent({
        uid: `activity-${act.id}@solocompass`,
        dtstart: startTime,
        dtend: endTime,
        summary: act.name || act.title || 'Activity',
        description: act.description || '',
        location: act.location_name || act.address || ''
      }));
    }
  }

  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//SoloCompass//TripCalendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    ...events,
    'END:VCALENDAR'
  ].join('\r\n');

  return ics;
}

/**
 * Unit Conversion Service
 * Handles km↔mi, °C↔°F, and currency conversions
 */

const CONVERSION_FACTORS = {
  distance: {
    km_to_mi: 0.621371,
    mi_to_km: 1.60934,
  },
  temperature: {
    c_to_f: (c) => (c * 9/5) + 32,
    f_to_c: (f) => (f - 32) * 5/9,
  },
};

export function convertDistance(value, from, to) {
  if (from === to) return value;
  if (from === 'km' && to === 'mi') return Math.round(value * CONVERSION_FACTORS.distance.km_to_mi * 100) / 100;
  if (from === 'mi' && to === 'km') return Math.round(value * CONVERSION_FACTORS.distance.mi_to_km * 100) / 100;
  return value;
}

export function convertTemperature(value, from, to) {
  if (from === to) return value;
  if (from === 'C' && to === 'F') return Math.round(CONVERSION_FACTORS.temperature.c_to_f(value) * 10) / 10;
  if (from === 'F' && to === 'C') return Math.round(CONVERSION_FACTORS.temperature.f_to_c(value) * 10) / 10;
  return value;
}

// Simple currency conversion using stored exchange rates
export async function convertCurrency(amount, from, to) {
  if (from === to) return amount;
  
  try {
    // Import db dynamically to avoid circular dependencies
    const { default: db } = await import('../db.js');
    const rate = await db.get(
      'SELECT rate FROM exchange_rates WHERE from_currency = ? AND to_currency = ? ORDER BY updated_at DESC LIMIT 1',
      from, to
    );
    
    if (rate) {
      return Math.round(amount * parseFloat(rate.rate) * 100) / 100;
    }
    
    // Try reverse rate
    const reverseRate = await db.get(
      'SELECT rate FROM exchange_rates WHERE from_currency = ? AND to_currency = ? ORDER BY updated_at DESC LIMIT 1',
      to, from
    );
    
    if (reverseRate) {
      return Math.round(amount / parseFloat(reverseRate.rate) * 100) / 100;
    }
    
    return amount; // Fallback: return unconverted
  } catch {
    return amount;
  }
}

/**
 * Apply user's unit preferences to a data object
 * @param {Object} data - Data object with values to convert
 * @param {Object} settings - User settings (distance_unit, temperature_unit, currency_preference)
 * @param {Object} fieldMap - Maps field names to their types: { fieldName: { type: 'distance'|'temperature'|'currency', from: 'km'|'C'|'GBP' } }
 */
export async function applyUserUnits(data, settings, fieldMap) {
  const result = { ...data };
  
  for (const [field, config] of Object.entries(fieldMap)) {
    if (result[field] === undefined || result[field] === null) continue;
    
    switch (config.type) {
      case 'distance':
        result[field] = convertDistance(result[field], config.from || 'km', settings.distance_unit || 'km');
        result[`${field}_unit`] = settings.distance_unit || 'km';
        break;
      case 'temperature':
        result[field] = convertTemperature(result[field], config.from || 'C', settings.temperature_unit || 'C');
        result[`${field}_unit`] = settings.temperature_unit === 'F' ? '°F' : '°C';
        break;
      case 'currency':
        result[field] = await convertCurrency(result[field], config.from || 'GBP', settings.currency_preference || 'GBP');
        result[`${field}_currency`] = settings.currency_preference || 'GBP';
        break;
    }
  }
  
  return result;
}

export default { convertDistance, convertTemperature, convertCurrency, applyUserUnits };

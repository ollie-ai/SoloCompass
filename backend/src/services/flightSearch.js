import axios from 'axios';

const AMADEUS_AUTH_URL = 'https://test.api.amadeus.com/v1/security/oauth2/token';
const AMADEUS_FLIGHTS_URL = 'https://test.api.amadeus.com/v2/shopping/flight-offers';

let amadeusTokenCache = { token: null, expiresAt: 0 };

async function getAmadeusAccessToken() {
  const now = Date.now();
  if (amadeusTokenCache.token && amadeusTokenCache.expiresAt > now + 10000) {
    return amadeusTokenCache.token;
  }

  const clientId = process.env.AMADEUS_CLIENT_ID;
  const clientSecret = process.env.AMADEUS_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  const formData = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
  });

  const response = await axios.post(AMADEUS_AUTH_URL, formData.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    timeout: 10000,
  });

  const token = response.data?.access_token;
  const expiresIn = response.data?.expires_in || 1200;
  if (!token) return null;

  amadeusTokenCache = {
    token,
    expiresAt: now + expiresIn * 1000,
  };

  return token;
}

function mapAmadeusOffer(offer) {
  const itinerary = offer?.itineraries?.[0];
  const segmentCount = itinerary?.segments?.length || 0;
  const firstSegment = itinerary?.segments?.[0];
  const lastSegment = itinerary?.segments?.[segmentCount - 1];
  return {
    id: offer?.id,
    price: {
      amount: Number(offer?.price?.grandTotal || 0),
      currency: offer?.price?.currency || 'USD',
    },
    airline: firstSegment?.carrierCode || 'N/A',
    departureTime: firstSegment?.departure?.at || null,
    arrivalTime: lastSegment?.arrival?.at || null,
    origin: firstSegment?.departure?.iataCode || null,
    destination: lastSegment?.arrival?.iataCode || null,
    stops: Math.max(0, segmentCount - 1),
    duration: itinerary?.duration || null,
  };
}

function buildStubFlights({ origin, destination, date, returnDate, passengers = 1 }) {
  return [
    {
      id: `stub-${origin}-${destination}-1`,
      price: { amount: 249.0, currency: 'USD' },
      airline: 'SC Airways',
      departureTime: `${date}T08:15:00`,
      arrivalTime: `${date}T11:05:00`,
      origin,
      destination,
      stops: 0,
      duration: 'PT2H50M',
      passengers,
      source: 'stub',
      note: returnDate ? `Return date requested: ${returnDate}` : undefined,
    },
    {
      id: `stub-${origin}-${destination}-2`,
      price: { amount: 199.0, currency: 'USD' },
      airline: 'BudgetJet',
      departureTime: `${date}T14:20:00`,
      arrivalTime: `${date}T18:05:00`,
      origin,
      destination,
      stops: 1,
      duration: 'PT3H45M',
      passengers,
      source: 'stub',
    },
  ];
}

export async function searchFlights(options) {
  const { origin, destination, date, returnDate, passengers = 1 } = options;

  const token = await getAmadeusAccessToken();
  if (!token) {
    return buildStubFlights({ origin, destination, date, returnDate, passengers });
  }

  try {
    const response = await axios.get(AMADEUS_FLIGHTS_URL, {
      headers: { Authorization: `Bearer ${token}` },
      params: {
        originLocationCode: origin,
        destinationLocationCode: destination,
        departureDate: date,
        returnDate: returnDate || undefined,
        adults: passengers,
        max: 20,
      },
      timeout: 12000,
    });

    const offers = response.data?.data || [];
    if (!offers.length) return [];
    return offers.map(mapAmadeusOffer);
  } catch {
    return buildStubFlights({ origin, destination, date, returnDate, passengers });
  }
}


/**
 * GROUND ZERO — Nuclear Scaling Laws & Geospatial Math
 * Pure headless simulation functions based on Glasstone-Dolan scaling laws.
 */

export const MAJOR_CITIES = [
  { name: "New York City, USA", lat: 40.7128, lng: -74.006 },
  { name: "Washington, D.C., USA", lat: 38.9072, lng: -77.0369 },
  { name: "Los Angeles, USA", lat: 34.0522, lng: -118.2437 },
  { name: "Chicago, USA", lat: 41.8781, lng: -87.6298 },
  { name: "London, UK", lat: 51.5074, lng: -0.1278 },
  { name: "Paris, France", lat: 48.8566, lng: 2.3522 },
  { name: "Berlin, Germany", lat: 52.52, lng: 13.405 },
  { name: "Moscow, Russia", lat: 55.7558, lng: 37.6173 },
  { name: "Kyiv, Ukraine", lat: 50.4501, lng: 30.5234 },
  { name: "Beijing, China", lat: 39.9042, lng: 116.4074 },
  { name: "Tokyo, Japan", lat: 35.6762, lng: 139.6503 },
  { name: "Hiroshima, Japan", lat: 34.3853, lng: 132.4553 },
  { name: "New Delhi, India", lat: 28.6139, lng: 77.209 },
  { name: "Mumbai, India", lat: 19.076, lng: 72.8777 },
  { name: "Tehran, Iran", lat: 35.6892, lng: 51.389 },
  { name: "Tel Aviv, Israel", lat: 32.0853, lng: 34.7818 },
  { name: "Sydney, Australia", lat: -33.8688, lng: 151.2093 }
];

export function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function findClosestCity(lat, lng, cities = MAJOR_CITIES) {
  let closest = null;
  let minDist = Infinity;
  for (const c of cities) {
    const d = getDistanceFromLatLonInKm(lat, lng, c.lat, c.lng);
    if (d < minDist) {
      minDist = d;
      closest = c;
    }
  }
  return { city: closest, distKm: minDist };
}

// Convert slider 0-1000 to log scale 0.01kt (10t) to 100,000kt (100Mt)
export function sliderToYield(val) {
  const minLog = Math.log10(0.01);
  const maxLog = Math.log10(100000);
  const logVal = minLog + (val / 1000) * (maxLog - minLog);
  return Math.pow(10, logVal);
}

export function yieldToSlider(kt) {
  const minLog = Math.log10(0.01);
  const maxLog = Math.log10(100000);
  const logVal = Math.log10(Math.max(0.01, kt));
  return Math.round(((logVal - minLog) / (maxLog - minLog)) * 1000);
}

// Glasstone & Dolan Physics scaling laws (Y in kilotons)
export function calcPhysics(Y) {
  const fireballKm = 0.066 * Math.pow(Y, 0.4);
  const psi20Km = 0.15 * Math.pow(Y, 1 / 3);
  const psi5Km = 0.28 * Math.pow(Y, 1 / 3);
  const psi1Km = 0.79 * Math.pow(Y, 1 / 3);
  const burns3rdKm = 0.38 * Math.pow(Y, 0.41);
  const radiationKm = 0.7 * Math.pow(Y, 0.19);

  return {
    fireballKm,
    psi20Km,
    psi5Km,
    psi1Km,
    burns3rdKm,
    radiationKm,
    hiroshimaEquiv: Y / 15
  };
}

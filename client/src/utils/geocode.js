// Shared geocoding utility using the Google Maps Geocoding API
const GOOGLE_MAPS_API_KEY = process.env.REACT_APP_GOOGLE_MAPS_KEY || '';

export async function geocodeAddress(address) {
  if (!address || !GOOGLE_MAPS_API_KEY) return null;
  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${GOOGLE_MAPS_API_KEY}`
    );
    const data = await response.json();
    const location = data.results?.[0]?.geometry?.location;
    if (location) {
      return { longitude: location.lng, latitude: location.lat };
    }
  } catch (error) {
    console.error('Geocoding error:', error);
  }
  return null;
}


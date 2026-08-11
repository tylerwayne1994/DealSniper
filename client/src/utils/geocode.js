// Shared geocoding utility. Routes through our own backend (see
// backend/geocode_api.py) — Google explicitly blocks HTTP-referrer-restricted
// keys (required for any key embedded in browser JS, like this one) from
// being used with server-executed APIs such as Geocoding, regardless of
// which APIs are enabled for that key. The backend uses a separate,
// never-exposed key instead. Falls back to calling Google directly only if
// the backend request itself fails (e.g. backend briefly unreachable).
import { API_BASE_URL } from '../config/api';

const GOOGLE_MAPS_API_KEY = process.env.REACT_APP_GOOGLE_MAPS_KEY || '';

export async function geocodeAddress(address) {
  if (!address) return null;
  try {
    const response = await fetch(`${API_BASE_URL}/api/geocode?address=${encodeURIComponent(address)}`);
    const data = await response.json();
    if (data?.latitude != null && data?.longitude != null) {
      return { latitude: data.latitude, longitude: data.longitude };
    }
  } catch (error) {
    console.warn('Backend geocode failed, falling back to direct Google call:', error);
  }
  if (!GOOGLE_MAPS_API_KEY) return null;
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


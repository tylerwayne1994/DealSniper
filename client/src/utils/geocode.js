// Shared geocoding utility using Mapbox Geocoding API
import mapboxgl from 'mapbox-gl';

export async function geocodeAddress(address) {
  if (!address || !mapboxgl.accessToken) return null;
  try {
    const response = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?access_token=${mapboxgl.accessToken}`
    );
    const data = await response.json();
    if (data.features && data.features.length > 0) {
      const [longitude, latitude] = data.features[0].center;
      return { longitude, latitude };
    }
  } catch (error) {
    console.error('Geocoding error:', error);
  }
  return null;
}

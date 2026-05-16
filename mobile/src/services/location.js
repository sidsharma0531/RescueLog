import * as Location from 'expo-location';
import { LOCATION_MATCH_RADIUS_METERS } from '../constants/config';

// Requests permission and returns the current GPS coordinates, or null if
// permission was denied or the fix failed.
export async function getCurrentLocation() {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return null;
    const loc = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });
    return {
      latitude: loc.coords.latitude,
      longitude: loc.coords.longitude,
    };
  } catch {
    return null;
  }
}

// Returns the first known location within the match radius, or null.
export function findNearbyLocation(coords, knownLocations) {
  if (!coords) return null;
  for (const loc of knownLocations || []) {
    const distance = haversineDistance(
      coords.latitude,
      coords.longitude,
      loc.latitude,
      loc.longitude,
    );
    if (distance <= LOCATION_MATCH_RADIUS_METERS) return loc;
  }
  return null;
}

// Turns GPS coordinates into a human-readable address, or null.
export async function reverseGeocode(latitude, longitude) {
  try {
    const results = await Location.reverseGeocodeAsync({ latitude, longitude });
    if (results && results.length > 0) {
      const r = results[0];
      const parts = [r.name || r.street, r.city, r.region].filter(Boolean);
      return parts.join(', ') || null;
    }
  } catch {
    /* ignore — address is optional */
  }
  return null;
}

// Great-circle distance between two coordinates, in meters.
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Earth radius, meters
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

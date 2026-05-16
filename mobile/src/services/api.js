import { API_BASE_URL } from '../constants/config';

// Thin wrapper around the RescueLog Next.js API.

async function request(path, options = {}) {
  let res;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, options);
  } catch (e) {
    throw new Error('Network error — check your connection and try again.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}

function postJson(path, body) {
  return request(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export function getDrivers() {
  return request('/api/drivers');
}

export function login(driverId, pin) {
  return postJson('/api/auth/login', { driver_id: driverId, pin });
}

export function getLocations() {
  return request('/api/locations');
}

export function createLocation(location) {
  return postJson('/api/locations', location);
}

export function createPopup(payload) {
  return postJson('/api/popups', payload);
}

export function getRecentPopups(driverId, limit = 5) {
  return request(`/api/popups?driver_id=${driverId}&limit=${limit}`);
}

// Uploads photos as multipart/form-data. React Native's fetch builds the
// multipart body from { uri, name, type } file descriptors — do not set a
// Content-Type header, fetch adds the multipart boundary itself.
export async function uploadPhotos(popupId, photoUris) {
  const form = new FormData();
  photoUris.forEach((uri, i) => {
    form.append('photos', { uri, name: `photo-${i}.jpg`, type: 'image/jpeg' });
  });

  let res;
  try {
    res = await fetch(`${API_BASE_URL}/api/popups/${popupId}/photos`, {
      method: 'POST',
      body: form,
    });
  } catch (e) {
    throw new Error('Upload failed — check your connection and try again.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Upload failed (${res.status})`);
  }
  return data;
}

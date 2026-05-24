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

// ── Organizations ───────────────────────────────────────────────
export function getOrganizations() {
  return request('/api/organizations');
}
export function createOrganization(payload) {
  return postJson('/api/organizations', payload);
}

// ── Drivers (scoped to one organization) ────────────────────────
export function getDrivers(organizationId) {
  return request(
    `/api/drivers?organization_id=${encodeURIComponent(organizationId)}`,
  );
}

// ── Driver auth ─────────────────────────────────────────────────
export function login(driverId, pin, organizationId) {
  return postJson('/api/auth/login', {
    driver_id: driverId,
    pin,
    organization_id: organizationId,
  });
}
export function register(organizationId, name, pin) {
  return postJson('/api/auth/register', {
    organization_id: organizationId,
    name,
    pin,
  });
}

// ── Locations ───────────────────────────────────────────────────
export function getLocations() {
  return request('/api/locations');
}
export function createLocation(location) {
  return postJson('/api/locations', location);
}

// ── Pop-up logs ─────────────────────────────────────────────────
export function createPopup(payload) {
  return postJson('/api/popups', payload);
}
export function getRecentPopups(driverId, limit = 5) {
  return request(`/api/popups?driver_id=${driverId}&limit=${limit}`);
}

// Multipart photo upload — React Native fetch builds the multipart body
// from { uri, name, type } file descriptors; do not set Content-Type
// manually, fetch picks the boundary itself.
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

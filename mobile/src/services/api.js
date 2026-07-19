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

// Photos are uploaded to Supabase Storage directly from the phone (see
// services/upload.js); here we just hand the resulting URLs to the API so
// it can run the AI pipeline. `photos` is [{ url, storage_path }].
//
// Large pop-ups run 60-70+ photos, so URLs are submitted in CHUNKS with
// retries, and the server's per-chunk `photos_received` is verified against
// what we sent. If any photo could not be attached after retries, this
// THROWS with exact counts — the app must never report success while the
// server holds fewer photos than the volunteer took.
const SUBMIT_CHUNK_SIZE = 25;
const SUBMIT_CHUNK_RETRIES = 3;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function submitPhotos(popupId, photos) {
  let attached = 0;
  for (let i = 0; i < photos.length; i += SUBMIT_CHUNK_SIZE) {
    const chunk = photos.slice(i, i + SUBMIT_CHUNK_SIZE);
    let lastErr = null;
    for (let attempt = 0; attempt < SUBMIT_CHUNK_RETRIES; attempt += 1) {
      try {
        const res = await postJson(`/api/popups/${popupId}/photos`, {
          photos: chunk,
        });
        attached += Number(res.photos_received) || 0;
        lastErr = null;
        break;
      } catch (e) {
        lastErr = e;
        await sleep(1500 * (attempt + 1));
      }
    }
    if (lastErr) {
      throw new Error(
        `Only ${attached} of ${photos.length} photos were attached (${photos.length - attached} failed). ` +
          'Your photos are uploaded and saved. Please tell your admin to re-sync this log instead of re-submitting.',
      );
    }
  }
  if (attached !== photos.length) {
    throw new Error(
      `The server accepted ${attached} of ${photos.length} photos. ` +
        'Your photos are uploaded and saved. Please tell your admin to re-sync this log instead of re-submitting.',
    );
  }
  return { photos_received: attached };
}

// Drive + read AI processing progress for a log. Each call analyzes the next
// small batch and returns counts: { status, total, completed, failed, done,
// pending }. Polled by the Confirm screen until status is terminal.
export function pollProcessing(popupId) {
  return postJson(`/api/popups/${popupId}/progress`, {});
}

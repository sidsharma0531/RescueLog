import crypto from 'crypto';

// Lightweight admin session for the dashboard. Security is intentionally
// minimal — this is an internal tool for ~3 trusted staff. The session is an
// HMAC-signed token (payload.signature) stored in an HTTP-only cookie.

export const SESSION_COOKIE = 'rescuelog_admin';
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days, in seconds

const SECRET = process.env.ADMIN_SESSION_SECRET || 'dev-insecure-secret-change-me';

export function createSessionToken(admin) {
  const payload = Buffer.from(
    JSON.stringify({
      id: admin.id,
      name: admin.name,
      email: admin.email,
      // The org this admin is scoped to. Null/absent for legacy admins → the
      // dashboard falls back to showing all orgs (pre-scoping behavior).
      organization_id: admin.organization_id ?? null,
      // The org's capture mode, for pop-up vs cart dashboard terminology.
      capture_mode: admin.capture_mode || 'popup',
    }),
  ).toString('base64url');
  const sig = crypto.createHmac('sha256', SECRET).update(payload).digest('hex');
  return `${payload}.${sig}`;
}

export function verifySessionToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [payload, sig] = token.split('.');
  const expected = crypto.createHmac('sha256', SECRET).update(payload).digest('hex');
  if (!sig || sig.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    return JSON.parse(Buffer.from(payload, 'base64url').toString());
  } catch {
    return null;
  }
}

// Works with both `cookies()` from next/headers and `NextRequest.cookies` —
// both expose `.get(name)` returning { value } or undefined.
export function getSession(cookieStore) {
  const cookie = cookieStore?.get(SESSION_COOKIE);
  return cookie ? verifySessionToken(cookie.value) : null;
}

// The organization id a dashboard request is scoped to, or null when the admin
// has no org (legacy session / unassigned admin) — in which case data routes
// show all orgs, preserving the pre-scoping behavior.
export function getSessionOrgId(cookieStore) {
  return getSession(cookieStore)?.organization_id || null;
}

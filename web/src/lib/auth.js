import crypto from 'crypto';

// Lightweight admin session for the dashboard. Security is intentionally
// minimal — this is an internal tool for ~3 trusted staff. The session is an
// HMAC-signed token (payload.signature) stored in an HTTP-only cookie.

export const SESSION_COOKIE = 'rescuelog_admin';
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days, in seconds

const SECRET = process.env.ADMIN_SESSION_SECRET || 'dev-insecure-secret-change-me';

// Fail closed: in production, refuse to sign or verify with a missing/weak
// secret. Otherwise an unset env var would make the public fallback constant
// the signing key, letting anyone forge an admin session for any organization.
// Guarding at the point of use (not module import) keeps `next build` from
// crashing while still making sessions un-creatable/un-verifiable until the
// secret is set — i.e. the dashboard locks rather than runs forgeable.
function secretIsInsecure() {
  return (
    !process.env.ADMIN_SESSION_SECRET ||
    process.env.ADMIN_SESSION_SECRET.length < 32
  );
}
function assertUsableSecret() {
  if (process.env.NODE_ENV === 'production' && secretIsInsecure()) {
    throw new Error(
      'ADMIN_SESSION_SECRET must be set to a strong (>=32 char) random value in production.',
    );
  }
}

export function createSessionToken(admin) {
  assertUsableSecret();
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
  // In production with a weak/absent secret, treat every token as invalid so a
  // forged cookie (signed with the public fallback) can never authenticate.
  if (process.env.NODE_ENV === 'production' && secretIsInsecure()) return null;
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
// has no org. Callers MUST treat null as unauthorized — never as "all orgs".
export function getSessionOrgId(cookieStore) {
  return getSession(cookieStore)?.organization_id || null;
}

// Fail-closed gate for dashboard/admin routes. Returns the session only when it
// is valid AND bound to an organization; otherwise null. A route that gets null
// must respond 401 — a session with no org is NOT granted blanket access.
// (Every real admin is assigned an organization_id by the multi-org migration;
// an admin missing one is a misconfiguration to fix in SQL, not a reason to
// leak every org's data.)
export function requireAdmin(cookieStore) {
  const session = getSession(cookieStore);
  if (!session || !session.organization_id) return null;
  return session;
}

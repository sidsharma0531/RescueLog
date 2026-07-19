import crypto from 'crypto';

// Lightweight admin session for the dashboard. Security is intentionally
// minimal — this is an internal tool for ~3 trusted staff. The session is an
// HMAC-signed token (payload.signature) stored in an HTTP-only cookie.

export const SESSION_COOKIE = 'rescuelog_admin';
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days, in seconds

// Which org a SUPER admin is currently viewing ('' / absent = all orgs).
// Regular admins never read or honor this cookie.
export const SUPER_ORG_COOKIE = 'rescuelog_super_org';

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
      // The org this admin is scoped to (null for super admins).
      organization_id: admin.organization_id ?? null,
      // The org's capture mode, for dashboard terminology.
      capture_mode: admin.capture_mode || 'popup',
      // Explicit master flag — NOT inferred from a missing organization_id.
      // Only set true from the is_super_admin database column at login.
      is_super_admin: admin.is_super_admin === true,
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
// is valid AND either bound to an organization OR explicitly flagged as a super
// admin; otherwise null. A route that gets null must respond 401 — a REGULAR
// session with no org is NOT granted blanket access (that would be the old
// cross-tenant hole). The super bypass is gated strictly on the explicit
// is_super_admin flag minted from the database column at login.
export function requireAdmin(cookieStore) {
  const session = getSession(cookieStore);
  if (!session) return null;
  if (session.is_super_admin === true) return session;
  if (!session.organization_id) return null;
  return session;
}

// The data scope a dashboard request operates under. This is THE single place
// that decides which org's rows a route may touch:
//   - Regular admin: always exactly their own org. The super-org picker cookie
//     is ignored for them entirely.
//   - Super admin: the org selected in the picker cookie, or ALL orgs when no
//     org is picked (orgId null + allOrgs true).
// Returns null when unauthorized. Routes must 401 on null and must only skip
// the org filter when scope.allOrgs is true (which only a super can produce).
export function getScope(cookieStore) {
  const session = requireAdmin(cookieStore);
  if (!session) return null;
  if (session.is_super_admin !== true) {
    return {
      session,
      superAdmin: false,
      orgId: session.organization_id,
      allOrgs: false,
    };
  }
  const picked = cookieStore?.get(SUPER_ORG_COOKIE)?.value || '';
  return { session, superAdmin: true, orgId: picked || null, allOrgs: !picked };
}

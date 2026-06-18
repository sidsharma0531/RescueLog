// Organization scoping for the dashboard.
//
// Admin accounts are not yet bound to a specific organization (the dashboard
// shows all logs), so dashboard-authored data — like the per-org price
// references — is scoped to a single default organization: the launch partner
// pinned in supabase/schema.sql. This constant is the ONE place to change when
// true per-admin org scoping is added (e.g. read it off the admin session).
export const DEFAULT_ORG_ID = '00000000-0000-0000-0000-000000000001';

// Resolve the organization id the dashboard is acting on. Override-by-env keeps
// it configurable per deployment without a code change.
export function getDashboardOrgId() {
  return process.env.DASHBOARD_ORG_ID || DEFAULT_ORG_ID;
}

// Resolve the organization a popup log's pricing should use: the log's own org
// when present, otherwise the dashboard default (legacy logs have a null org).
export function orgIdForLog(organizationId) {
  return organizationId || getDashboardOrgId();
}

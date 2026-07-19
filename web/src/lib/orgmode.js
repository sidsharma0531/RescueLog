import { supabaseAdmin } from './supabase';

// SERVER-ONLY. Resolve capture modes for dashboard requests.

// An org's capture mode, from the database. select('*') keeps this resilient
// on databases that predate the capture_mode column.
export async function captureModeForOrg(orgId) {
  if (!orgId) return 'popup';
  const { data } = await supabaseAdmin
    .from('organizations')
    .select('*')
    .eq('id', orgId)
    .maybeSingle();
  return ['cart', 'gleaning'].includes(data?.capture_mode)
    ? data.capture_mode
    : 'popup';
}

// The effective capture mode for a request scope (see auth.getScope):
//   super + all orgs   -> 'all' (neutral terms, union categories)
//   super + picked org -> that org's real mode, exactly as its admin sees it
//   regular admin      -> the mode minted into their session at login
export async function captureModeForScope(scope) {
  if (!scope) return 'popup';
  if (scope.superAdmin) {
    return scope.allOrgs ? 'all' : captureModeForOrg(scope.orgId);
  }
  return scope.session.capture_mode || 'popup';
}

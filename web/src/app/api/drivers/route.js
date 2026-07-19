import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase';
import { getScope } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// GET /api/drivers?organization_id=X — active drivers in an organization.
// A signed-in regular admin is always pinned to their own org (the query param
// is ignored for them, so one org's dashboard can't enumerate another's
// roster). A super admin gets their picked org, or every org's drivers in the
// all-orgs view (for the dashboard filter dropdowns). The unauthenticated
// mobile login dropdown must pass organization_id. Never returns PINs.
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const scope = getScope(cookies());

    let query = supabaseAdmin
      .from('drivers')
      .select('id, name')
      .eq('is_active', true)
      .order('name');

    if (scope) {
      if (scope.orgId) query = query.eq('organization_id', scope.orgId);
      // else: super admin all-orgs — intentionally unfiltered (names only).
    } else {
      const organizationId = searchParams.get('organization_id');
      if (!organizationId) {
        return NextResponse.json(
          { error: 'organization_id is required.' },
          { status: 400 },
        );
      }
      query = query.eq('organization_id', organizationId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({ drivers: data || [] });
  } catch (e) {
    console.error('[drivers] load failed:', e?.message || e);
    return NextResponse.json(
      { error: 'Could not load drivers.' },
      { status: 500 },
    );
  }
}

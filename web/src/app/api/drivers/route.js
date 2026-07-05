import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase';
import { getSessionOrgId } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// GET /api/drivers?organization_id=X — active drivers in an organization.
// A signed-in admin is always pinned to their own org (the query param is
// ignored for them, so one org's dashboard can't enumerate another's roster).
// The unauthenticated mobile login dropdown must pass organization_id. We never
// return an unfiltered, all-orgs roster. Never returns PINs.
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const organizationId =
      getSessionOrgId(cookies()) || searchParams.get('organization_id');
    if (!organizationId) {
      return NextResponse.json(
        { error: 'organization_id is required.' },
        { status: 400 },
      );
    }

    const { data, error } = await supabaseAdmin
      .from('drivers')
      .select('id, name')
      .eq('is_active', true)
      .eq('organization_id', organizationId)
      .order('name');
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

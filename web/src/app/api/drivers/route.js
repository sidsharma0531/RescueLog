import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase';
import { getSessionOrgId } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// GET /api/drivers?organization_id=X — active drivers in an organization.
// The mobile login dropdown passes organization_id explicitly; the dashboard
// calls without it and falls back to the signed-in admin's org, so its driver
// filter is scoped to that org. Never returns PINs.
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const organizationId =
      searchParams.get('organization_id') || getSessionOrgId(cookies());

    let query = supabaseAdmin
      .from('drivers')
      .select('id, name')
      .eq('is_active', true)
      .order('name');
    if (organizationId) query = query.eq('organization_id', organizationId);

    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({ drivers: data || [] });
  } catch (e) {
    return NextResponse.json(
      { error: e.message || 'Could not load drivers.' },
      { status: 500 },
    );
  }
}

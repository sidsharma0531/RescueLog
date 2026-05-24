import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// GET /api/drivers?organization_id=X — active drivers in an organization
// (for the mobile login dropdown). organization_id is required so the
// dropdown is always scoped to a specific org. Never returns PINs.
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get('organization_id');

    if (!organizationId) {
      return NextResponse.json(
        { error: 'organization_id query parameter is required.' },
        { status: 400 },
      );
    }

    const { data, error } = await supabaseAdmin
      .from('drivers')
      .select('id, name')
      .eq('organization_id', organizationId)
      .eq('is_active', true)
      .order('name');
    if (error) throw error;
    return NextResponse.json({ drivers: data || [] });
  } catch (e) {
    return NextResponse.json(
      { error: e.message || 'Could not load drivers.' },
      { status: 500 },
    );
  }
}

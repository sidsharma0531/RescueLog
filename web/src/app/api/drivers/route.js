import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// GET /api/drivers — active driver names for the mobile login dropdown.
// Never returns PINs.
export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('drivers')
      .select('id, name')
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

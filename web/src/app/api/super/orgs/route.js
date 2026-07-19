import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase';
import { requireAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// GET /api/super/orgs — the org list for the super admin's org switcher.
// Super admins only; regular admins have no business enumerating orgs.
export async function GET() {
  try {
    const session = requireAdmin(cookies());
    if (!session || session.is_super_admin !== true) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }
    const { data, error } = await supabaseAdmin
      .from('organizations')
      .select('*')
      .eq('status', 'approved')
      .order('name');
    if (error) throw error;
    return NextResponse.json({
      organizations: (data || []).map((o) => ({
        id: o.id,
        name: o.name,
        capture_mode: ['cart', 'gleaning'].includes(o.capture_mode)
          ? o.capture_mode
          : 'popup',
      })),
    });
  } catch (e) {
    console.error('[super/orgs] failed:', e?.message || e);
    return NextResponse.json({ error: 'Could not load organizations.' }, { status: 500 });
  }
}

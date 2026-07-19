import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase';
import { requireAdmin, SUPER_ORG_COOKIE } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// POST /api/super/org — set which org the super admin is viewing.
// Body: { organization_id: '<uuid>' } to drill into one org, or '' / null for
// the all-orgs aggregate. Super admins only; the cookie is meaningless (and
// ignored) for regular admins, but we still refuse to set it for them.
export async function POST(request) {
  try {
    const session = requireAdmin(cookies());
    if (!session || session.is_super_admin !== true) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const orgId = body.organization_id ? String(body.organization_id) : '';

    if (orgId) {
      const { data: org } = await supabaseAdmin
        .from('organizations')
        .select('id')
        .eq('id', orgId)
        .eq('status', 'approved')
        .maybeSingle();
      if (!org) {
        return NextResponse.json({ error: 'Unknown organization.' }, { status: 400 });
      }
    }

    const res = NextResponse.json({ success: true, organization_id: orgId || null });
    res.cookies.set(SUPER_ORG_COOKIE, orgId, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    });
    return res;
  } catch (e) {
    console.error('[super/org] failed:', e?.message || e);
    return NextResponse.json({ error: 'Could not switch organization.' }, { status: 500 });
  }
}

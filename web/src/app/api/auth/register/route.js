import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// POST /api/auth/register — create a new driver inside an organization.
// Returns the driver record so the mobile app can auto-log in.
export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const organizationId = body.organization_id;
    const name = String(body.name || '').trim().slice(0, 100);
    const pin = String(body.pin || '').trim();

    if (!organizationId) {
      return NextResponse.json(
        { error: 'organization_id is required.' },
        { status: 400 },
      );
    }
    if (!name) {
      return NextResponse.json(
        { error: 'Your name is required.' },
        { status: 400 },
      );
    }
    if (!/^\d{4}$/.test(pin)) {
      return NextResponse.json(
        { error: 'PIN must be 4 digits.' },
        { status: 400 },
      );
    }

    // Confirm the org exists and is approved — pending orgs can't onboard
    // new drivers yet.
    const { data: org, error: orgErr } = await supabaseAdmin
      .from('organizations')
      .select('id, status')
      .eq('id', organizationId)
      .maybeSingle();
    if (orgErr) throw orgErr;
    if (!org) {
      return NextResponse.json(
        { error: 'Organization not found.' },
        { status: 404 },
      );
    }
    if (org.status !== 'approved') {
      return NextResponse.json(
        { error: 'This organization is not yet approved.' },
        { status: 403 },
      );
    }

    // Prevent two active drivers with the same name in the same org —
    // the driver dropdown would be ambiguous.
    const { data: clash } = await supabaseAdmin
      .from('drivers')
      .select('id')
      .eq('organization_id', organizationId)
      .ilike('name', name)
      .limit(1);
    if (clash && clash.length > 0) {
      return NextResponse.json(
        { error: 'That name is already used in this organization.' },
        { status: 409 },
      );
    }

    const { data: driver, error } = await supabaseAdmin
      .from('drivers')
      .insert({
        organization_id: organizationId,
        name,
        pin,
        is_active: true,
      })
      .select('id, name')
      .single();
    if (error) throw error;

    return NextResponse.json({ success: true, driver }, { status: 201 });
  } catch (e) {
    console.error('[auth/register] failed:', e?.message || e);
    return NextResponse.json(
      { error: 'Could not create account.' },
      { status: 500 },
    );
  }
}

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// POST /api/auth/login — driver login via name (or id) + 4-digit PIN.
// Security is intentionally minimal: returns the driver object, which the
// mobile app stores locally. No JWT.
export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { driver_id, driver_name, pin } = body;

    if ((!driver_id && !driver_name) || !pin) {
      return NextResponse.json(
        { error: 'Driver and PIN are required.' },
        { status: 400 },
      );
    }

    let query = supabaseAdmin
      .from('drivers')
      .select('id, name, pin, is_active, organization_id');
    query = driver_id
      ? query.eq('id', driver_id)
      : query.eq('name', driver_name);

    const { data, error } = await query.limit(1).maybeSingle();
    if (error) throw error;

    if (!data || !data.is_active) {
      return NextResponse.json({ error: 'Driver not found.' }, { status: 404 });
    }
    // If the caller specified an organization (the mobile app does), make
    // sure the driver actually belongs to it — a stale org pick on the
    // device shouldn't be able to log into a different organization.
    if (
      body.organization_id &&
      data.organization_id !== body.organization_id
    ) {
      return NextResponse.json({ error: 'Driver not found.' }, { status: 404 });
    }
    if (String(data.pin) !== String(pin).trim()) {
      return NextResponse.json({ error: 'Wrong PIN.' }, { status: 401 });
    }

    return NextResponse.json({
      success: true,
      driver: { id: data.id, name: data.name },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e.message || 'Login failed.' },
      { status: 500 },
    );
  }
}

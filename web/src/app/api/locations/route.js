import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// GET /api/locations — all known pop-up sites. The mobile app uses this to
// match the current GPS position to a previously named location.
export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('locations')
      .select('id, name, address, latitude, longitude')
      .order('name');
    if (error) throw error;
    return NextResponse.json({ locations: data || [] });
  } catch (e) {
    return NextResponse.json(
      { error: e.message || 'Could not load locations.' },
      { status: 500 },
    );
  }
}

// POST /api/locations — create a new named site (first time a driver logs a
// pop-up at a GPS spot that does not match any existing location).
export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const name = String(body.name || '').trim().slice(0, 200);
    const latitude = Number(body.latitude);
    const longitude = Number(body.longitude);

    if (!name) {
      return NextResponse.json(
        { error: 'A location name is required.' },
        { status: 400 },
      );
    }
    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
      return NextResponse.json(
        { error: 'Valid latitude and longitude are required.' },
        { status: 400 },
      );
    }

    const { data, error } = await supabaseAdmin
      .from('locations')
      .insert({
        name,
        address: body.address ? String(body.address).slice(0, 300) : null,
        latitude,
        longitude,
      })
      .select('id, name, address, latitude, longitude')
      .single();
    if (error) throw error;

    return NextResponse.json({ location: data }, { status: 201 });
  } catch (e) {
    console.error('[locations] create failed:', e?.message || e);
    return NextResponse.json(
      { error: 'Could not create location.' },
      { status: 500 },
    );
  }
}

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { startOfDay, endOfDay } from '@/lib/dates';

export const dynamic = 'force-dynamic';

const POPUP_SELECT =
  '*, driver:drivers(id, name), location:locations(id, name, address)';

// GET /api/popups — list pop-up logs with optional filters.
// ?from=&to=&location_id=&driver_id=&status=&limit=
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(Number(searchParams.get('limit')) || 200, 500);

    let query = supabaseAdmin
      .from('popup_logs')
      .select(POPUP_SELECT)
      .order('logged_at', { ascending: false })
      .limit(limit);

    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const locationId = searchParams.get('location_id');
    const driverId = searchParams.get('driver_id');
    const status = searchParams.get('status');

    if (from) query = query.gte('logged_at', startOfDay(from));
    if (to) query = query.lte('logged_at', endOfDay(to));
    if (locationId) query = query.eq('location_id', locationId);
    if (driverId) query = query.eq('driver_id', driverId);
    if (status) query = query.eq('status', status);

    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({ popups: data || [] });
  } catch (e) {
    return NextResponse.json(
      { error: e.message || 'Could not load pop-ups.' },
      { status: 500 },
    );
  }
}

// POST /api/popups — create a new pop-up log (status starts as 'processing').
export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));

    if (!body.driver_id) {
      return NextResponse.json(
        { error: 'driver_id is required.' },
        { status: 400 },
      );
    }
    const manualName = body.location_name_manual
      ? String(body.location_name_manual).trim()
      : '';
    const isCart = body.mode === 'cart';
    // Cart logs aren't tied to a pop-up site, so they don't require a location.
    if (!isCart && !body.location_id && !manualName) {
      return NextResponse.json(
        { error: 'A location (location_id or location_name_manual) is required.' },
        { status: 400 },
      );
    }

    const insert = {
      driver_id: body.driver_id,
      organization_id: body.organization_id || null,
      location_id: body.location_id || null,
      location_name_manual: manualName || null,
      latitude: numOrNull(body.latitude),
      longitude: numOrNull(body.longitude),
      driver_weight_estimate: numOrNull(body.driver_weight_estimate),
      notes: body.notes ? String(body.notes) : null,
      status: 'processing',
      photo_count: 0,
    };
    // Cart Mode (Second Mile): record the capture mode + the scale weight, which
    // is the cart's ground-truth total. Only set for cart logs so the pop-up
    // path is byte-for-byte unchanged — and so it still works on databases
    // where the Cart Mode columns haven't been migrated in yet.
    if (isCart) {
      insert.mode = 'cart';
      insert.scale_weight_lbs = numOrNull(body.scale_weight_lbs);
    }

    const { data, error } = await supabaseAdmin
      .from('popup_logs')
      .insert(insert)
      .select('id, status')
      .single();
    if (error) throw error;

    return NextResponse.json({ id: data.id, status: data.status }, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: e.message || 'Could not create pop-up log.' },
      { status: 500 },
    );
  }
}

function numOrNull(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

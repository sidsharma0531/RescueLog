import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase';
import { requireAdmin } from '@/lib/auth';
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
    const driverId = searchParams.get('driver_id');

    let query = supabaseAdmin
      .from('popup_logs')
      .select(POPUP_SELECT)
      .order('logged_at', { ascending: false })
      .limit(limit);

    // Two authorized shapes, fail closed on everything else:
    //  - Dashboard admin: scoped to the admin's org (never all-orgs).
    //  - Mobile driver home screen: only that driver's OWN logs, via driver_id.
    //    (No admin token exists on the phone; this is bounded to a single
    //    driver's own data. Fully closing it needs a real mobile session.)
    const session = requireAdmin(cookies());
    if (session) {
      query = query.eq('organization_id', session.organization_id);
    } else if (driverId) {
      query = query.eq('driver_id', driverId);
    } else {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const locationId = searchParams.get('location_id');
    const status = searchParams.get('status');

    if (from) query = query.gte('logged_at', startOfDay(from));
    if (to) query = query.lte('logged_at', endOfDay(to));
    if (locationId) query = query.eq('location_id', locationId);
    // Admins may additionally filter by driver within their org.
    if (session && driverId) query = query.eq('driver_id', driverId);
    if (status) query = query.eq('status', status);

    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({ popups: data || [] });
  } catch (e) {
    console.error('[popups] list failed:', e?.message || e);
    return NextResponse.json(
      { error: 'Could not load pop-ups.' },
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

    // Derive the org from the driver server-side. Never trust body.organization_id
    // — otherwise any caller could inject logs into an arbitrary organization.
    const { data: driver, error: driverErr } = await supabaseAdmin
      .from('drivers')
      .select('organization_id, is_active')
      .eq('id', body.driver_id)
      .maybeSingle();
    if (driverErr) throw driverErr;
    if (!driver || !driver.is_active) {
      return NextResponse.json(
        { error: 'Unknown or inactive driver.' },
        { status: 401 },
      );
    }

    const manualName = body.location_name_manual
      ? String(body.location_name_manual).trim().slice(0, 200)
      : '';
    // Capture modes: 'popup' (default), 'cart' (Second Mile), 'gleaning'
    // (Glean Kentucky). Anything unrecognized falls back to popup.
    const mode = ['cart', 'gleaning'].includes(body.mode) ? body.mode : 'popup';
    const isCart = mode === 'cart';
    // Cart logs aren't tied to a pop-up site, so they don't require a location.
    // Gleaning logs use GPS/manual locations exactly like pop-ups.
    if (!isCart && !body.location_id && !manualName) {
      return NextResponse.json(
        { error: 'A location (location_id or location_name_manual) is required.' },
        { status: 400 },
      );
    }

    const insert = {
      driver_id: body.driver_id,
      organization_id: driver.organization_id,
      location_id: body.location_id || null,
      location_name_manual: manualName || null,
      latitude: latOrNull(body.latitude),
      longitude: lonOrNull(body.longitude),
      driver_weight_estimate: weightOrNull(body.driver_weight_estimate),
      notes: body.notes ? String(body.notes).slice(0, 2000) : null,
      status: 'processing',
      photo_count: 0,
    };
    // Non-popup modes record the capture mode + an optional scale weight (the
    // cart's ground-truth total for Second Mile; an optional override for
    // gleaning trips). Only set for those logs so the pop-up path is
    // byte-for-byte unchanged — and so it still works on databases where the
    // columns haven't been migrated in yet.
    if (mode !== 'popup') {
      insert.mode = mode;
      insert.scale_weight_lbs = weightOrNull(body.scale_weight_lbs);
    }
    // Household id (Second Mile per-household tracking). Only added to the
    // insert when provided, so the pop-up path is untouched and a cart log
    // without one still saves on databases that predate the column.
    if (body.household_id != null && String(body.household_id).trim() !== '') {
      insert.household_id = String(body.household_id).trim().slice(0, 200);
    }
    // Donor/source + recipient agency (gleaning trip reporting). Optional,
    // only added when provided, resilient to the columns not existing yet.
    if (body.donor_source != null && String(body.donor_source).trim() !== '') {
      insert.donor_source = String(body.donor_source).trim().slice(0, 200);
    }
    if (body.recipient_agency != null && String(body.recipient_agency).trim() !== '') {
      insert.recipient_agency = String(body.recipient_agency).trim().slice(0, 200);
    }

    const { data, error } = await supabaseAdmin
      .from('popup_logs')
      .insert(insert)
      .select('id, status')
      .single();
    if (error) throw error;

    return NextResponse.json({ id: data.id, status: data.status }, { status: 201 });
  } catch (e) {
    console.error('[popups] create failed:', e?.message || e);
    return NextResponse.json(
      { error: 'Could not create pop-up log.' },
      { status: 500 },
    );
  }
}

function numInRange(v, min, max) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < min || n > max) return null;
  return n;
}
const latOrNull = (v) => numInRange(v, -90, 90);
const lonOrNull = (v) => numInRange(v, -180, 180);
// Cap weights at a sane upper bound (lbs) so a bad client can't store garbage.
const weightOrNull = (v) => numInRange(v, 0, 1_000_000);

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { startOfDay, endOfDay } from '@/lib/dates';
import { CATEGORIES } from '@/lib/categories';
import { categorySummaryToFlatRow } from '@/lib/aggregate';

export const dynamic = 'force-dynamic';

// GET /api/export/csv?from=&to=&location_id=&driver_id=
// Returns a CSV file shaped for pasting straight into Excel grant workbooks.
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const locationId = searchParams.get('location_id');
    const driverId = searchParams.get('driver_id');

    let query = supabaseAdmin
      .from('popup_logs')
      .select('*, driver:drivers(name), location:locations(name)')
      .order('logged_at', { ascending: false });
    if (from) query = query.gte('logged_at', startOfDay(from));
    if (to) query = query.lte('logged_at', endOfDay(to));
    if (locationId) query = query.eq('location_id', locationId);
    if (driverId) query = query.eq('driver_id', driverId);

    const { data: logs, error } = await query;
    if (error) throw error;

    const header = [
      'Date',
      'Location',
      'Driver',
      'Total AI Weight (lbs)',
      'Driver Weight (lbs)',
      ...CATEGORIES.flatMap((c) => [`${c.label} (lbs)`, `${c.label} (%)`]),
      'Photo Count',
      'Confidence Score',
      'Status',
    ];

    const rows = (logs || []).map((p) => {
      const flat = categorySummaryToFlatRow(p.ai_category_summary);
      return [
        formatDate(p.logged_at),
        p.location?.name || p.location_name_manual || '',
        p.driver?.name || '',
        numCell(p.ai_total_weight),
        numCell(p.driver_weight_estimate),
        ...CATEGORIES.flatMap((c) => [flat[`${c.key}_lbs`], flat[`${c.key}_pct`]]),
        p.photo_count ?? 0,
        p.ai_category_summary?.overall_confidence ?? '',
        p.status || '',
      ];
    });

    const csv = [header, ...rows]
      .map((r) => r.map(csvEscape).join(','))
      .join('\r\n');

    const today = new Date().toISOString().slice(0, 10);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="rescuelog-export-${today}.csv"`,
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e.message || 'Export failed.' },
      { status: 500 },
    );
  }
}

function csvEscape(v) {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function numCell(v) {
  if (v === null || v === undefined || v === '') return '';
  const n = Number(v);
  return Number.isNaN(n) ? '' : n;
}

function formatDate(ts) {
  return ts ? new Date(ts).toISOString().slice(0, 10) : '';
}

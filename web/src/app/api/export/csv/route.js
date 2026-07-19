import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase';
import { getScope } from '@/lib/auth';
import { captureModeForScope } from '@/lib/orgmode';
import { startOfDay, endOfDay } from '@/lib/dates';
import { getCategories, profileForMode } from '@/lib/categories';
import { categorySummaryToFlatRow } from '@/lib/aggregate';

export const dynamic = 'force-dynamic';

// GET /api/export/csv?from=&to=&location_id=&driver_id=
// Returns a CSV file shaped for pasting straight into Excel grant workbooks.
export async function GET(request) {
  try {
    const scope = getScope(cookies());
    if (!scope) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const locationId = searchParams.get('location_id');
    const driverId = searchParams.get('driver_id');

    let query = supabaseAdmin
      .from('popup_logs')
      .select(
        '*, driver:drivers(name), location:locations(name), organization:organizations(name)',
      )
      .order('logged_at', { ascending: false });
    // Org filter: always for regular admins; skipped only in the super
    // admin's all-orgs export (which gains an Organization column below).
    if (scope.orgId) query = query.eq('organization_id', scope.orgId);
    if (from) query = query.gte('logged_at', startOfDay(from));
    if (to) query = query.lte('logged_at', endOfDay(to));
    if (locationId) query = query.eq('location_id', locationId);
    if (driverId) query = query.eq('driver_id', driverId);

    const { data: logs, error } = await query;
    if (error) throw error;

    // Category columns follow the scope's profile: the org's own set, or the
    // union of every set for the super admin's all-orgs export.
    const profile = profileForMode(await captureModeForScope(scope));
    const categories = getCategories(profile);

    const header = [
      ...(scope.allOrgs ? ['Organization'] : []),
      'Date',
      'Location',
      'Submitted By',
      'Household ID',
      'Donor/Source',
      'Recipient Agency',
      'Scale Weight (lbs)',
      'Total AI Weight (lbs)',
      'Total Est. Retail Value ($)',
      'Driver Weight (lbs)',
      ...categories.flatMap((c) => [
        `${c.label} (lbs)`,
        `${c.label} (%)`,
        `${c.label} (Est. $)`,
      ]),
      'Photo Count',
      'Confidence Score',
      'Status',
      'Notes',
    ];

    const rows = (logs || []).map((p) => {
      const flat = categorySummaryToFlatRow(p.ai_category_summary, profile);
      return [
        ...(scope.allOrgs ? [p.organization?.name || ''] : []),
        formatDate(p.logged_at),
        p.location?.name || p.location_name_manual || '',
        p.driver?.name || '',
        p.household_id || '',
        p.donor_source || '',
        p.recipient_agency || '',
        numCell(p.scale_weight_lbs),
        numCell(p.ai_total_weight),
        numCell(p.ai_total_value ?? p.ai_category_summary?.total_value_usd),
        numCell(p.driver_weight_estimate),
        ...categories.flatMap((c) => [
          flat[`${c.key}_lbs`],
          flat[`${c.key}_pct`],
          flat[`${c.key}_value`],
        ]),
        p.photo_count ?? 0,
        p.ai_category_summary?.overall_confidence ?? '',
        p.status || '',
        p.notes || '',
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
  let s = v === null || v === undefined ? '' : String(v);
  // Neutralize spreadsheet formula injection: a cell an attacker can control
  // (driver/location/household names) that starts with =, +, -, @, or a
  // control char is treated as a formula by Excel/Sheets. Prefix a single
  // quote so it renders as literal text.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
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

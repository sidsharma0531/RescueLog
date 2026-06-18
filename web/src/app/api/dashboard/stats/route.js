import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase';
import { getSessionOrgId } from '@/lib/auth';
import { startOfDay, endOfDay, toDateKey } from '@/lib/dates';
import { CATEGORY_KEYS, normalizeCategoryKey } from '@/lib/categories';

export const dynamic = 'force-dynamic';

const round1 = (n) => Math.round(n * 10) / 10;

// GET /api/dashboard/stats?from=&to= — aggregated numbers for the overview.
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    // select('*') (not an explicit ai_total_value column) so the overview keeps
    // working before the value-column migration; the value is read from
    // ai_category_summary as a fallback below.
    let query = supabaseAdmin
      .from('popup_logs')
      .select('*, location:locations(name)')
      .order('logged_at', { ascending: false });
    const orgId = getSessionOrgId(cookies());
    if (orgId) query = query.eq('organization_id', orgId);
    if (from) query = query.gte('logged_at', startOfDay(from));
    if (to) query = query.lte('logged_at', endOfDay(to));

    const { data, error } = await query;
    if (error) throw error;
    const popups = data || [];

    const catWeights = Object.fromEntries(CATEGORY_KEYS.map((k) => [k, 0]));
    const catValues = Object.fromEntries(CATEGORY_KEYS.map((k) => [k, 0]));
    const siteWeights = {}; // name -> { weight, count }
    const byDay = {}; // dateKey -> { date, count, weight }
    let totalAiWeight = 0;
    let totalAiValue = 0;
    let totalDriverWeight = 0;

    for (const p of popups) {
      totalAiWeight += Number(p.ai_total_weight) || 0;
      totalAiValue +=
        Number(p.ai_total_value ?? p.ai_category_summary?.total_value_usd) || 0;
      totalDriverWeight += Number(p.driver_weight_estimate) || 0;

      for (const c of p.ai_category_summary?.categories || []) {
        catWeights[normalizeCategoryKey(c.name)] += Number(c.weight_lbs) || 0;
        catValues[normalizeCategoryKey(c.name)] += Number(c.value_usd) || 0;
      }

      const site = p.location?.name || p.location_name_manual || 'Unknown site';
      siteWeights[site] = siteWeights[site] || { weight: 0, count: 0 };
      siteWeights[site].weight += Number(p.ai_total_weight) || 0;
      siteWeights[site].count += 1;

      const day = toDateKey(p.logged_at);
      byDay[day] = byDay[day] || { date: day, count: 0, weight: 0 };
      byDay[day].count += 1;
      byDay[day].weight += Number(p.ai_total_weight) || 0;
    }

    const totalCatWeight = CATEGORY_KEYS.reduce((s, k) => s + catWeights[k], 0);
    const categoryTotals = {};
    for (const k of CATEGORY_KEYS) {
      categoryTotals[k] = {
        weight_lbs: Math.round(catWeights[k]),
        value_usd: Math.round(catValues[k]),
        percentage:
          totalCatWeight > 0 ? round1((catWeights[k] / totalCatWeight) * 100) : 0,
      };
    }

    let topKey = null;
    for (const k of CATEGORY_KEYS) {
      if (catWeights[k] > 0 && (!topKey || catWeights[k] > catWeights[topKey])) {
        topKey = k;
      }
    }

    return NextResponse.json({
      total_popups: popups.length,
      total_ai_weight_lbs: Math.round(totalAiWeight),
      total_est_value_usd: Math.round(totalAiValue),
      total_driver_weight_lbs: Math.round(totalDriverWeight),
      unique_sites: Object.keys(siteWeights).length,
      category_totals: categoryTotals,
      top_category: topKey ? { key: topKey, ...categoryTotals[topKey] } : null,
      top_sites: Object.entries(siteWeights)
        .map(([name, v]) => ({
          name,
          weight_lbs: Math.round(v.weight),
          popup_count: v.count,
        }))
        .sort((a, b) => b.weight_lbs - a.weight_lbs)
        .slice(0, 8),
      popups_by_day: Object.values(byDay)
        .map((d) => ({ ...d, weight: Math.round(d.weight) }))
        .sort((a, b) => a.date.localeCompare(b.date)),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e.message || 'Could not load stats.' },
      { status: 500 },
    );
  }
}

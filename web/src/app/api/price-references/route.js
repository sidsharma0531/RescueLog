import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase';
import { getSessionOrgId } from '@/lib/auth';
import { getDashboardOrgId } from '@/lib/org';

export const dynamic = 'force-dynamic';

// The org whose prices the signed-in admin manages — their session org, or the
// dashboard default for a legacy admin without one.
function priceOrgId() {
  return getSessionOrgId(cookies()) || getDashboardOrgId();
}

const UNITS = ['per_unit', 'per_lb'];

// Validate + coerce a price-reference payload. Returns { value } or { error }.
function parseBody(body) {
  const item_name = String(body?.item_name || '').trim();
  if (!item_name) return { error: 'item_name is required.' };

  const price_usd = Number(body?.price_usd);
  if (!Number.isFinite(price_usd) || price_usd < 0) {
    return { error: 'price_usd must be a non-negative number.' };
  }

  const unit = UNITS.includes(body?.unit) ? body.unit : 'per_unit';
  return { value: { item_name, price_usd: Math.round(price_usd * 100) / 100, unit } };
}

// GET /api/price-references — list the dashboard org's pinned item prices.
export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('price_references')
      .select('id, item_name, price_usd, unit, created_at')
      .eq('organization_id', priceOrgId())
      .order('item_name', { ascending: true });
    if (error) throw error;
    return NextResponse.json({ price_references: data || [] });
  } catch (e) {
    return NextResponse.json(
      { error: e.message || 'Could not load price references.' },
      { status: 500 },
    );
  }
}

// POST /api/price-references — add a pinned item price for the dashboard org.
export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { value, error: invalid } = parseBody(body);
    if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });

    const { data, error } = await supabaseAdmin
      .from('price_references')
      .insert({ ...value, organization_id: priceOrgId() })
      .select('id, item_name, price_usd, unit, created_at')
      .single();
    if (error) throw error;
    return NextResponse.json({ price_reference: data }, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: e.message || 'Could not add price reference.' },
      { status: 500 },
    );
  }
}

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase';
import { getScope } from '@/lib/auth';

export const dynamic = 'force-dynamic';

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

// GET /api/price-references — list the signed-in admin org's pinned item prices.
export async function GET() {
  try {
    const scope = getScope(cookies());
    if (!scope) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }
    // Pricing is inherently per-org: a super admin must pick an org first.
    if (!scope.orgId) {
      return NextResponse.json(
        { error: 'Select an organization to manage pricing.' },
        { status: 400 },
      );
    }
    const { data, error } = await supabaseAdmin
      .from('price_references')
      .select('id, item_name, price_usd, unit, created_at')
      .eq('organization_id', scope.orgId)
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
    const scope = getScope(cookies());
    if (!scope) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }
    // Pricing is inherently per-org: a super admin must pick an org first.
    if (!scope.orgId) {
      return NextResponse.json(
        { error: 'Select an organization to manage pricing.' },
        { status: 400 },
      );
    }
    const body = await request.json().catch(() => ({}));
    const { value, error: invalid } = parseBody(body);
    if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });

    const { data, error } = await supabaseAdmin
      .from('price_references')
      .insert({ ...value, organization_id: scope.orgId })
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

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase';
import { requireAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const UNITS = ['per_unit', 'per_lb'];

// PATCH /api/price-references/[id] — edit a pinned item price.
export async function PATCH(request, { params }) {
  try {
    const session = requireAdmin(cookies());
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }
    const body = await request.json().catch(() => ({}));
    const update = {};

    if (body.item_name !== undefined) {
      const name = String(body.item_name).trim();
      if (!name) {
        return NextResponse.json({ error: 'item_name cannot be empty.' }, { status: 400 });
      }
      update.item_name = name;
    }
    if (body.price_usd !== undefined) {
      const price = Number(body.price_usd);
      if (!Number.isFinite(price) || price < 0) {
        return NextResponse.json(
          { error: 'price_usd must be a non-negative number.' },
          { status: 400 },
        );
      }
      update.price_usd = Math.round(price * 100) / 100;
    }
    if (body.unit !== undefined) {
      if (!UNITS.includes(body.unit)) {
        return NextResponse.json({ error: 'unit must be per_unit or per_lb.' }, { status: 400 });
      }
      update.unit = body.unit;
    }
    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 });
    }

    // Scope to the caller's org so an id from another org can't be edited.
    const { data, error } = await supabaseAdmin
      .from('price_references')
      .update(update)
      .eq('id', params.id)
      .eq('organization_id', session.organization_id)
      .select('id, item_name, price_usd, unit, created_at')
      .maybeSingle();
    if (error) throw error;
    if (!data) {
      return NextResponse.json({ error: 'Price reference not found.' }, { status: 404 });
    }
    return NextResponse.json({ price_reference: data });
  } catch (e) {
    return NextResponse.json(
      { error: e.message || 'Could not update price reference.' },
      { status: 500 },
    );
  }
}

// DELETE /api/price-references/[id] — remove a pinned item price.
export async function DELETE(request, { params }) {
  try {
    const session = requireAdmin(cookies());
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }
    const { error } = await supabaseAdmin
      .from('price_references')
      .delete()
      .eq('id', params.id)
      .eq('organization_id', session.organization_id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e.message || 'Could not delete price reference.' },
      { status: 500 },
    );
  }
}

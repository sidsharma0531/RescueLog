import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// GET /api/organizations — list approved organizations, alphabetical.
// Used by the mobile org-select dropdown.
export async function GET() {
  try {
    // select('*') (not an explicit capture_mode column) so this keeps working
    // on databases where the Cart Mode migration hasn't been applied yet —
    // capture_mode simply defaults to 'popup' until the column exists.
    const { data, error } = await supabaseAdmin
      .from('organizations')
      .select('*')
      .eq('status', 'approved')
      .order('name');
    if (error) throw error;
    const organizations = (data || []).map((o) => ({
      id: o.id,
      name: o.name,
      capture_mode: o.capture_mode === 'cart' ? 'cart' : 'popup',
    }));
    return NextResponse.json({ organizations });
  } catch (e) {
    return NextResponse.json(
      { error: e.message || 'Could not load organizations.' },
      { status: 500 },
    );
  }
}

// POST /api/organizations — register a new organization as 'pending'.
// An admin flips status to 'approved' in Supabase to make it appear in
// the org-select dropdown.
export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const name = String(body.org_name || body.name || '').trim();
    const contactName = String(body.contact_name || '').trim();
    const email = String(body.email || '').trim();
    const phone = String(body.phone || '').trim();

    if (!name) {
      return NextResponse.json(
        { error: 'Organization name is required.' },
        { status: 400 },
      );
    }

    const { data, error } = await supabaseAdmin
      .from('organizations')
      .insert({
        name,
        status: 'pending',
        contact_name: contactName || null,
        email: email || null,
        phone: phone || null,
      })
      .select('id, name, status')
      .single();
    if (error) throw error;

    return NextResponse.json({ organization: data }, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: e.message || 'Could not register organization.' },
      { status: 500 },
    );
  }
}

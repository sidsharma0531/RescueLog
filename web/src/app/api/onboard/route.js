import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// POST /api/onboard — store a "Get started" signup from the /onboard page.
export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const orgName = String(body.org_name || '').trim();
    const contactName = String(body.contact_name || '').trim();
    const email = String(body.email || '').trim();
    const phone = String(body.phone || '').trim();

    if (!orgName) {
      return NextResponse.json(
        { error: 'Organization name is required.' },
        { status: 400 },
      );
    }
    if (!email) {
      return NextResponse.json(
        { error: 'An email address is required.' },
        { status: 400 },
      );
    }

    const { error } = await supabaseAdmin.from('org_signups').insert({
      org_name: orgName,
      contact_name: contactName || null,
      email,
      phone: phone || null,
    });
    if (error) throw error;

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: e.message || 'Could not submit your request.' },
      { status: 500 },
    );
  }
}

import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { supabaseAdmin } from '@/lib/supabase';
import {
  createSessionToken,
  SESSION_COOKIE,
  SESSION_MAX_AGE,
} from '@/lib/auth';

// POST /api/auth/admin-login — admin email + password; sets an HTTP-only
// session cookie for the dashboard.
export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required.' },
        { status: 400 },
      );
    }

    // select('*') so organization_id is included where present without
    // breaking logins on databases that predate the org-scoping migration.
    const { data: admin, error } = await supabaseAdmin
      .from('admin_users')
      .select('*')
      .eq('email', email)
      .limit(1)
      .maybeSingle();
    if (error) throw error;

    const ok = admin && (await bcrypt.compare(password, admin.password_hash));
    if (!ok) {
      return NextResponse.json(
        { error: 'Invalid email or password.' },
        { status: 401 },
      );
    }

    // Resolve the org's capture mode so the dashboard can show pop-up vs cart
    // terminology. select('*') keeps this resilient if capture_mode is absent.
    if (admin.organization_id) {
      const { data: org } = await supabaseAdmin
        .from('organizations')
        .select('*')
        .eq('id', admin.organization_id)
        .maybeSingle();
      admin.capture_mode = org?.capture_mode === 'cart' ? 'cart' : 'popup';
    }

    const res = NextResponse.json({
      success: true,
      admin: { id: admin.id, name: admin.name, email: admin.email },
    });
    res.cookies.set(SESSION_COOKIE, createSessionToken(admin), {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: SESSION_MAX_AGE,
    });
    return res;
  } catch (e) {
    console.error('[auth/admin-login] failed:', e?.message || e);
    return NextResponse.json({ error: 'Login failed.' }, { status: 500 });
  }
}

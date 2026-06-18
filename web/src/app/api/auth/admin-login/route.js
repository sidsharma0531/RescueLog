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
    return NextResponse.json(
      { error: e.message || 'Login failed.' },
      { status: 500 },
    );
  }
}

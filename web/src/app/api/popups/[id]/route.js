import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// GET /api/popups/[id] — one pop-up log with every photo and its AI analysis.
export async function GET(request, { params }) {
  try {
    const { id } = params;

    const { data: popup, error } = await supabaseAdmin
      .from('popup_logs')
      .select('*, driver:drivers(id, name), location:locations(id, name, address)')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    if (!popup) {
      return NextResponse.json(
        { error: 'Pop-up log not found.' },
        { status: 404 },
      );
    }

    const { data: photos, error: photoErr } = await supabaseAdmin
      .from('popup_photos')
      .select('*')
      .eq('popup_log_id', id)
      .order('photo_order', { ascending: true });
    if (photoErr) throw photoErr;

    return NextResponse.json({ popup: { ...popup, photos: photos || [] } });
  } catch (e) {
    return NextResponse.json(
      { error: e.message || 'Could not load pop-up.' },
      { status: 500 },
    );
  }
}

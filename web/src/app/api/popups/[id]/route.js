import { NextResponse } from 'next/server';
import { supabaseAdmin, PHOTO_BUCKET } from '@/lib/supabase';

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

// PATCH /api/popups/[id] — update editable fields on a pop-up log.
// Supports renaming the location via location_name (written to
// location_name_manual) and editing the event time via logged_at.
export async function PATCH(request, { params }) {
  try {
    const { id } = params;
    const body = await request.json().catch(() => ({}));
    const update = {};

    if (body.location_name !== undefined) {
      const name =
        typeof body.location_name === 'string' ? body.location_name.trim() : '';
      if (!name) {
        return NextResponse.json(
          { error: 'A location name is required.' },
          { status: 400 },
        );
      }
      update.location_name_manual = name;
    }

    if (body.logged_at !== undefined) {
      const when = new Date(body.logged_at);
      if (Number.isNaN(when.getTime())) {
        return NextResponse.json(
          { error: 'A valid date and time is required.' },
          { status: 400 },
        );
      }
      update.logged_at = when.toISOString();
    }

    if (body.manual_estimate_lbs !== undefined) {
      if (body.manual_estimate_lbs === null) {
        update.manual_estimate_lbs = null; // allow clearing
      } else {
        const lbs = Number(body.manual_estimate_lbs);
        if (Number.isNaN(lbs) || lbs < 0) {
          return NextResponse.json(
            { error: 'A valid weight is required.' },
            { status: 400 },
          );
        }
        update.manual_estimate_lbs = lbs;
      }
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json(
        { error: 'Nothing to update.' },
        { status: 400 },
      );
    }

    const { data, error } = await supabaseAdmin
      .from('popup_logs')
      .update(update)
      .eq('id', id)
      .select('id, location_name_manual, logged_at, manual_estimate_lbs')
      .maybeSingle();
    if (error) throw error;
    if (!data) {
      return NextResponse.json(
        { error: 'Pop-up log not found.' },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, popup: data });
  } catch (e) {
    return NextResponse.json(
      { error: e.message || 'Could not update pop-up.' },
      { status: 500 },
    );
  }
}

// DELETE /api/popups/[id] — remove a pop-up log, its photo rows (via FK
// cascade), and the underlying storage objects.
export async function DELETE(request, { params }) {
  try {
    const { id } = params;

    // Grab the storage paths first so we can clean up the bucket before
    // the popup_photos rows cascade away.
    const { data: photos, error: fetchErr } = await supabaseAdmin
      .from('popup_photos')
      .select('storage_path')
      .eq('popup_log_id', id);
    if (fetchErr) throw fetchErr;

    const paths = (photos || [])
      .map((p) => p.storage_path)
      .filter(Boolean);

    if (paths.length > 0) {
      const { error: storageErr } = await supabaseAdmin.storage
        .from(PHOTO_BUCKET)
        .remove(paths);
      if (storageErr) {
        // Best effort — failing the request would leave the log
        // half-deleted; orphan storage objects are recoverable.
        console.warn(
          '[popups/delete] storage cleanup partial:',
          storageErr.message,
        );
      }
    }

    const { error: deleteErr } = await supabaseAdmin
      .from('popup_logs')
      .delete()
      .eq('id', id);
    if (deleteErr) throw deleteErr;

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json(
      { error: e.message || 'Could not delete pop-up.' },
      { status: 500 },
    );
  }
}

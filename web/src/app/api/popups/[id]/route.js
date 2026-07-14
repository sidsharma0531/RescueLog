import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  supabaseAdmin,
  PHOTO_BUCKET,
  withSignedPhotoUrls,
} from '@/lib/supabase';
import { requireAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// Fail closed: a log is off-limits unless the caller has an org-scoped session
// AND the log belongs to exactly that org. (After the multi-org backfill no log
// has a null org, so this never blocks legitimate access.)
function blockedByOrg(logOrgId, sessionOrgId) {
  return !sessionOrgId || logOrgId !== sessionOrgId;
}

// GET /api/popups/[id] — one pop-up log with every photo and its AI analysis.
export async function GET(request, { params }) {
  try {
    const session = requireAdmin(cookies());
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }
    const { id } = params;

    const { data: popup, error } = await supabaseAdmin
      .from('popup_logs')
      .select('*, driver:drivers(id, name), location:locations(id, name, address)')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    if (!popup || blockedByOrg(popup.organization_id, session.organization_id)) {
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

    // Serve signed URLs so images load regardless of the bucket's public
    // flag / read policy.
    const signedPhotos = await withSignedPhotoUrls(photos);
    return NextResponse.json({ popup: { ...popup, photos: signedPhotos } });
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
    const session = requireAdmin(cookies());
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }
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

    // Donor/source + recipient agency (gleaning trip reporting). Editable from
    // the dashboard detail page; empty string or null clears the field.
    for (const field of ['donor_source', 'recipient_agency']) {
      if (body[field] !== undefined) {
        const v = body[field] == null ? '' : String(body[field]).trim();
        update[field] = v ? v.slice(0, 200) : null;
      }
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json(
        { error: 'Nothing to update.' },
        { status: 400 },
      );
    }

    const { data: existing } = await supabaseAdmin
      .from('popup_logs')
      .select('organization_id')
      .eq('id', id)
      .maybeSingle();
    if (!existing || blockedByOrg(existing.organization_id, session.organization_id)) {
      return NextResponse.json({ error: 'Pop-up log not found.' }, { status: 404 });
    }

    const { data, error } = await supabaseAdmin
      .from('popup_logs')
      .update(update)
      .eq('id', id)
      .select('*')
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
    const session = requireAdmin(cookies());
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }
    const { id } = params;

    // Org guard before any destructive work, so an admin can't delete another
    // org's log (or its photos) by id.
    const { data: existing } = await supabaseAdmin
      .from('popup_logs')
      .select('organization_id')
      .eq('id', id)
      .maybeSingle();
    if (!existing || blockedByOrg(existing.organization_id, session.organization_id)) {
      return NextResponse.json({ error: 'Pop-up log not found.' }, { status: 404 });
    }

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

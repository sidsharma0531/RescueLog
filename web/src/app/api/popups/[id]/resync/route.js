import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { waitUntil } from '@vercel/functions';
import { supabaseAdmin, PHOTO_BUCKET } from '@/lib/supabase';
import { getScope } from '@/lib/auth';
import { drainBatches } from '@/lib/analyze';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function runInBackground(promise) {
  promise.catch(() => {});
  try {
    waitUntil(promise);
  } catch {
    /* not on Vercel */
  }
}

// POST /api/popups/[id]/resync — attach any photo that reached Storage but
// never got a database row (e.g. a partially failed submit), then kick off
// analysis for the newly attached photos. Idempotent: returns attached: 0
// when nothing is missing. Admin-only, scoped to the admin's own org.
export async function POST(request, { params }) {
  try {
    const scope = getScope(cookies());
    if (!scope) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }
    const { id: logId } = params;

    const { data: log, error: logErr } = await supabaseAdmin
      .from('popup_logs')
      .select('id, organization_id')
      .eq('id', logId)
      .maybeSingle();
    if (logErr) throw logErr;
    // Own org only for regular admins; supers may re-sync any org's log.
    if (!log || (!scope.superAdmin && log.organization_id !== scope.orgId)) {
      return NextResponse.json({ error: 'Pop-up log not found.' }, { status: 404 });
    }

    // Everything the phone uploaded lives under the log's own storage folder.
    const { data: objects, error: listErr } = await supabaseAdmin.storage
      .from(PHOTO_BUCKET)
      .list(logId, { limit: 500 });
    if (listErr) throw listErr;

    const { data: rows, error: rowsErr } = await supabaseAdmin
      .from('popup_photos')
      .select('storage_path')
      .eq('popup_log_id', logId);
    if (rowsErr) throw rowsErr;

    const have = new Set((rows || []).map((r) => r.storage_path));
    const missing = (objects || [])
      .map((o) => `${logId}/${o.name}`)
      .filter((p) => !have.has(p));

    if (missing.length === 0) {
      return NextResponse.json({
        attached: 0,
        storage_objects: (objects || []).length,
        photo_rows: (rows || []).length,
      });
    }

    const baseOrder = (rows || []).length;
    const { error: insertErr } = await supabaseAdmin.from('popup_photos').insert(
      missing.map((path, i) => ({
        popup_log_id: logId,
        photo_url: supabaseAdmin.storage.from(PHOTO_BUCKET).getPublicUrl(path)
          .data.publicUrl,
        storage_path: path,
        photo_order: baseOrder + i,
        processing_status: 'processing',
      })),
    );
    if (insertErr) throw insertErr;

    await supabaseAdmin
      .from('popup_logs')
      .update({ status: 'processing', photo_count: baseOrder + missing.length })
      .eq('id', logId);

    console.log(
      `[resync] log ${logId}: attached ${missing.length} orphaned photo(s); draining in background`,
    );
    runInBackground(drainBatches(logId));

    return NextResponse.json({
      attached: missing.length,
      storage_objects: (objects || []).length,
      photo_rows: baseOrder + missing.length,
      status: 'processing',
    });
  } catch (e) {
    console.error('[resync] failed:', e?.message || e);
    return NextResponse.json({ error: 'Re-sync failed.' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { baseUrlFrom, triggerProcessNext } from '@/lib/analyze';

export const dynamic = 'force-dynamic';
// This route only records photo rows and kicks off the analysis chain, so it
// returns in a couple seconds regardless of photo count.
export const maxDuration = 60;

const MAX_PHOTOS_PER_REQUEST = 40;

// POST /api/popups/[id]/photos
// Body: { photos: [{ url, storage_path }] }
//
// Photos are uploaded to Supabase Storage directly from the mobile app, so
// this endpoint only receives URLs. It records the photo rows, kicks off the
// self-chaining analysis queue (process-next), and returns immediately with
// status 'processing'. The dashboard polls the log until it reaches a
// terminal status.
export async function POST(request, { params }) {
  const { id: logId } = params;
  try {
    // 1. The log must exist.
    const { data: log, error: logErr } = await supabaseAdmin
      .from('popup_logs')
      .select('id')
      .eq('id', logId)
      .maybeSingle();
    if (logErr) throw logErr;
    if (!log) {
      return NextResponse.json(
        { error: 'Pop-up log not found.' },
        { status: 404 },
      );
    }

    // 2. Pull the photo URLs out of the JSON body.
    const body = await request.json().catch(() => ({}));
    const photos = (Array.isArray(body.photos) ? body.photos : [])
      .map((p) => ({
        url: typeof p?.url === 'string' ? p.url.trim() : '',
        storage_path:
          typeof p?.storage_path === 'string' ? p.storage_path : null,
      }))
      .filter((p) => p.url)
      .slice(0, MAX_PHOTOS_PER_REQUEST);

    if (photos.length === 0) {
      return NextResponse.json(
        { error: 'No photo URLs were provided.' },
        { status: 400 },
      );
    }

    // 3. Continue numbering after any photos already attached to this log.
    const { count: existingCount } = await supabaseAdmin
      .from('popup_photos')
      .select('id', { count: 'exact', head: true })
      .eq('popup_log_id', logId);
    const baseOrder = existingCount || 0;

    // 4. Insert a row per photo (status 'processing' until the AI runs).
    const { error: insertErr } = await supabaseAdmin
      .from('popup_photos')
      .insert(
        photos.map((p, i) => ({
          popup_log_id: logId,
          photo_url: p.url,
          storage_path: p.storage_path,
          photo_order: baseOrder + i,
          processing_status: 'processing',
        })),
      );
    if (insertErr) throw insertErr;

    // 5. Mark the log processing and record the new photo count.
    await supabaseAdmin
      .from('popup_logs')
      .update({ status: 'processing', photo_count: baseOrder + photos.length })
      .eq('id', logId);

    // 6. Kick off the analysis chain (process-next returns 202 immediately
    //    and analyzes in the background), then return right away.
    const base = baseUrlFrom(request);
    console.log(
      `[photos] log ${logId}: inserted ${photos.length} photo(s); ` +
        `kicking off analysis chain via ${base}`,
    );
    try {
      await triggerProcessNext(base, logId);
      console.log(`[photos] log ${logId}: analysis chain kicked off`);
    } catch (e) {
      // Log loudly — don't fail the user's upload, but make sure a failed
      // kickoff is visible instead of dying silently. The log stays
      // 'processing' and can be re-triggered by uploading again.
      console.error(
        `[photos] log ${logId}: FAILED to kick off analysis chain:`,
        e?.message || e,
      );
    }

    return NextResponse.json(
      { photos_received: photos.length, status: 'processing' },
      { status: 202 },
    );
  } catch (e) {
    return NextResponse.json(
      { error: e.message || 'Could not save photos.' },
      { status: 500 },
    );
  }
}

import { NextResponse } from 'next/server';
import { waitUntil } from '@vercel/functions';
import { supabaseAdmin, isOwnBucketPhotoUrl } from '@/lib/supabase';
import { drainBatches } from '@/lib/analyze';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Upper bound on URLs per request. This is a payload-sanity limit, not a
// per-log cap: the request body carries only URLs (photo bytes go straight to
// Storage from the phone), and the AI runs asynchronously afterwards, so a
// large batch costs one cheap bulk insert. The mobile app chunks its submits
// well below this. NEVER silently truncate — a request over the limit is
// rejected loudly (see below) so no photo can be dropped without the client
// knowing. (A silent .slice() here once dropped 24 of a 64-photo pop-up.)
const MAX_PHOTOS_PER_REQUEST = 200;

// Run work after the HTTP response. On Vercel, waitUntil keeps the function
// alive until the promise settles (bounded by maxDuration); off-Vercel
// (local dev) it may throw and the promise simply runs detached.
function runInBackground(promise) {
  promise.catch(() => {});
  try {
    waitUntil(promise);
  } catch {
    /* not on Vercel */
  }
}

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
    const rawPhotos = (Array.isArray(body.photos) ? body.photos : [])
      .map((p) => ({
        url: typeof p?.url === 'string' ? p.url.trim() : '',
        storage_path:
          typeof p?.storage_path === 'string' ? p.storage_path : null,
      }))
      .filter((p) => p.url);

    // Over-limit requests fail LOUDLY. Truncating here would silently lose
    // photos while the client believes everything was attached.
    if (rawPhotos.length > MAX_PHOTOS_PER_REQUEST) {
      return NextResponse.json(
        {
          error: `Too many photos in one request (${rawPhotos.length}). Send at most ${MAX_PHOTOS_PER_REQUEST} per request, in batches.`,
        },
        { status: 400 },
      );
    }

    // Only accept URLs that point at OUR photo bucket, and only storage paths
    // inside THIS log's own folder. Without this, a caller could (a) make the
    // vision model fetch — and bill us for — arbitrary attacker URLs, and
    // (b) plant another org's object path that a later delete would remove.
    const photos = rawPhotos.filter(
      (p) =>
        isOwnBucketPhotoUrl(p.url) &&
        (p.storage_path === null ||
          p.storage_path.startsWith(`${logId}/`)),
    );

    if (photos.length === 0) {
      return NextResponse.json(
        { error: 'No valid photo URLs were provided.' },
        { status: 400 },
      );
    }
    if (photos.length < rawPhotos.length) {
      console.warn(
        `[photos] log ${logId}: rejected ${rawPhotos.length - photos.length} photo(s) with an out-of-bucket URL or foreign storage path`,
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

    // 6. Process as many batches as fit in this function's time budget,
    //    in the background. No server-to-server self-calls — anything left
    //    over is finished by the dashboard's poll (process-next). Return
    //    right away so the upload is never blocked on AI.
    console.log(
      `[photos] log ${logId}: inserted ${photos.length} photo(s); draining batches in background`,
    );
    runInBackground(drainBatches(logId));

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

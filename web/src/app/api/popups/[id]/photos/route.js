import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { analyzePopupPhotoFromUrl } from '@/lib/anthropic';
import { aggregatePhotoAnalyses } from '@/lib/aggregate';

export const dynamic = 'force-dynamic';
// Claude Vision fetches each photo by URL. Photos are analyzed in small
// sequential batches (see below) to stay under Anthropic's concurrency
// rate limits.
export const maxDuration = 60;

const MAX_PHOTOS_PER_REQUEST = 40;

// Rate-limit-friendly processing. Photos run BATCH_SIZE at a time, batches
// run one after another with BATCH_DELAY_MS between them, and any photo
// that hits a 429 waits RETRY_DELAY_MS and retries up to MAX_RETRIES times.
const BATCH_SIZE = 3;
const BATCH_DELAY_MS = 1000;
const RETRY_DELAY_MS = 5000;
const MAX_RETRIES = 3;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// True if an error looks like an Anthropic 429 rate-limit error.
function isRateLimitError(err) {
  if (!err) return false;
  if (err.status === 429 || err.statusCode === 429) return true;
  return /\b429\b|rate.?limit/i.test(String(err.message || ''));
}

// Analyze one photo URL, retrying on 429 up to MAX_RETRIES times.
async function analyzeWithRetry(url) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await analyzePopupPhotoFromUrl(url);
    } catch (err) {
      if (isRateLimitError(err) && attempt < MAX_RETRIES) {
        await sleep(RETRY_DELAY_MS);
        continue;
      }
      throw err;
    }
  }
}

// Analyze all photos in sequential batches of BATCH_SIZE, pausing
// BATCH_DELAY_MS between batches. Returns a settled result per photo, in
// the same order as the input.
async function analyzeInBatches(photos) {
  const results = [];
  for (let i = 0; i < photos.length; i += BATCH_SIZE) {
    const batch = photos.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.allSettled(
      batch.map((p) => analyzeWithRetry(p.url)),
    );
    results.push(...batchResults);
    if (i + BATCH_SIZE < photos.length) {
      await sleep(BATCH_DELAY_MS);
    }
  }
  return results;
}

// POST /api/popups/[id]/photos
// Body: { photos: [{ url, storage_path }] }
//
// Photos are uploaded to Supabase Storage directly from the mobile app
// (bypassing Vercel's ~4.5MB request-body limit), so this endpoint only
// receives URLs. It records the photo rows, runs the AI pipeline against
// the URLs, and aggregates the result onto the pop-up log.
export async function POST(request, { params }) {
  const { id: logId } = params;
  try {
    // 1. The log must exist — also gives us the driver's weight estimate.
    const { data: log, error: logErr } = await supabaseAdmin
      .from('popup_logs')
      .select('id, driver_weight_estimate')
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

    // 4. Insert a row per photo.
    const { data: photoRows, error: insertErr } = await supabaseAdmin
      .from('popup_photos')
      .insert(
        photos.map((p, i) => ({
          popup_log_id: logId,
          photo_url: p.url,
          storage_path: p.storage_path,
          photo_order: baseOrder + i,
          processing_status: 'processing',
        })),
      )
      .select('id, photo_order');
    if (insertErr) throw insertErr;

    const rowByOrder = new Map(photoRows.map((r) => [r.photo_order, r]));

    // 5. Analyze the photo URLs with Claude Vision in small sequential
    //    batches with 429 retries, so large submissions don't trip
    //    Anthropic's concurrency rate limits. Order is preserved, so
    //    results[i] still corresponds to photos[i].
    const results = await analyzeInBatches(photos);

    // 6. Write each photo's analysis (or error) back to its row.
    await Promise.all(
      results.map((result, i) => {
        const row = rowByOrder.get(baseOrder + i);
        if (!row) return Promise.resolve();
        if (result.status === 'fulfilled') {
          return supabaseAdmin
            .from('popup_photos')
            .update({
              ai_analysis: result.value,
              ai_confidence: result.value.overall_confidence ?? null,
              processing_status: 'complete',
              processing_error: null,
            })
            .eq('id', row.id);
        }
        return supabaseAdmin
          .from('popup_photos')
          .update({
            processing_status: 'failed',
            processing_error: String(
              result.reason?.message || result.reason || 'AI analysis failed',
            ),
          })
          .eq('id', row.id);
      }),
    );

    // 7. Aggregate every completed photo for this log into the log summary.
    const { data: allPhotos } = await supabaseAdmin
      .from('popup_photos')
      .select('ai_analysis, processing_status')
      .eq('popup_log_id', logId);

    const completed = (allPhotos || []).filter(
      (p) => p.processing_status === 'complete' && p.ai_analysis,
    );
    const failedCount = (allPhotos || []).filter(
      (p) => p.processing_status === 'failed',
    ).length;

    const summary = aggregatePhotoAnalyses(
      completed.map((p) => p.ai_analysis),
      log.driver_weight_estimate,
    );

    let status = 'complete';
    if (completed.length === 0) status = 'failed';
    else if (failedCount > 0) status = 'partial';

    await supabaseAdmin
      .from('popup_logs')
      .update({
        ai_category_summary: summary,
        ai_total_weight: summary.total_weight_lbs,
        photo_count: (allPhotos || []).length,
        status,
        processed_at: new Date().toISOString(),
      })
      .eq('id', logId);

    return NextResponse.json({
      photos_received: photos.length,
      processing: false,
      status,
      summary,
    });
  } catch (e) {
    // Don't leave the log stuck in 'processing' if something blew up.
    await supabaseAdmin
      .from('popup_logs')
      .update({ status: 'failed', processed_at: new Date().toISOString() })
      .eq('id', logId)
      .then(
        () => {},
        () => {},
      );
    return NextResponse.json(
      { error: e.message || 'Photo processing failed.' },
      { status: 500 },
    );
  }
}

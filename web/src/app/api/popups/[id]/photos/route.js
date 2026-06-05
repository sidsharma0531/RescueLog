import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { analyzePopupPhotoFromUrl } from '@/lib/anthropic';
import { aggregatePhotoAnalyses } from '@/lib/aggregate';

export const dynamic = 'force-dynamic';
// Claude Vision fetches each photo by URL and analyzes them in parallel.
// 60s gives comfortable headroom for a large (20+ photo) submission.
export const maxDuration = 60;

const MAX_PHOTOS_PER_REQUEST = 40;

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

    // 5. Analyze every photo URL with Claude Vision in parallel.
    //    allSettled keeps one bad photo from failing the whole batch.
    const results = await Promise.allSettled(
      photos.map((p) => analyzePopupPhotoFromUrl(p.url)),
    );

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

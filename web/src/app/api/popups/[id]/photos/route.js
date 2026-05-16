import { NextResponse } from 'next/server';
import { supabaseAdmin, uploadPhoto } from '@/lib/supabase';
import { analyzePopupPhoto } from '@/lib/anthropic';
import { aggregatePhotoAnalyses } from '@/lib/aggregate';

export const dynamic = 'force-dynamic';
// Photos are analyzed by Claude Vision in parallel inside this request.
// 60s gives comfortable headroom for a typical 4-8 photo submission.
export const maxDuration = 60;

const SUPPORTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_PHOTOS_PER_REQUEST = 30;

// POST /api/popups/[id]/photos — upload photos, run the AI pipeline, and
// aggregate the result onto the pop-up log.
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

    // 2. Pull uploaded files out of the multipart body.
    const formData = await request.formData();
    const files = [...formData.getAll('photos'), ...formData.getAll('photo')]
      .filter(
        (f) =>
          f &&
          typeof f === 'object' &&
          typeof f.arrayBuffer === 'function' &&
          f.size > 0,
      )
      .slice(0, MAX_PHOTOS_PER_REQUEST);

    if (files.length === 0) {
      return NextResponse.json(
        { error: 'No photos were uploaded.' },
        { status: 400 },
      );
    }

    // 3. Continue numbering after any photos already attached to this log.
    const { count: existingCount } = await supabaseAdmin
      .from('popup_photos')
      .select('id', { count: 'exact', head: true })
      .eq('popup_log_id', logId);
    const baseOrder = existingCount || 0;

    // 4. Upload every file to Supabase Storage in parallel.
    const uploads = await Promise.all(
      files.map(async (file, i) => {
        const buffer = Buffer.from(await file.arrayBuffer());
        const mime = SUPPORTED_TYPES.includes(file.type)
          ? file.type
          : 'image/jpeg';
        const ext = mime.split('/')[1] || 'jpg';
        const order = baseOrder + i;
        const path = `${logId}/${Date.now()}-${order}.${ext}`;
        const { publicUrl } = await uploadPhoto(buffer, path, mime);
        return { buffer, mime, order, path, publicUrl };
      }),
    );

    // 5. Insert a row per photo.
    const { data: photoRows, error: insertErr } = await supabaseAdmin
      .from('popup_photos')
      .insert(
        uploads.map((u) => ({
          popup_log_id: logId,
          photo_url: u.publicUrl,
          storage_path: u.path,
          photo_order: u.order,
          processing_status: 'processing',
        })),
      )
      .select('id, photo_order');
    if (insertErr) throw insertErr;

    const rowByOrder = new Map(photoRows.map((r) => [r.photo_order, r]));

    // 6. Analyze every photo with Claude Vision in parallel. allSettled keeps
    //    one bad photo from failing the whole batch.
    const results = await Promise.allSettled(
      uploads.map((u) => analyzePopupPhoto(u.buffer.toString('base64'), u.mime)),
    );

    // 7. Write each photo's analysis (or error) back to its row.
    await Promise.all(
      results.map((result, i) => {
        const row = rowByOrder.get(uploads[i].order);
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

    // 8. Aggregate every completed photo for this log into the log summary.
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
      photos_uploaded: files.length,
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
      { error: e.message || 'Photo upload failed.' },
      { status: 500 },
    );
  }
}

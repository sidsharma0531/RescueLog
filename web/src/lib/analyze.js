import { supabaseAdmin } from './supabase';
import { analyzePopupPhotoFromUrl } from './anthropic';
import { aggregatePhotoAnalyses } from './aggregate';

// SERVER-ONLY. Runs the AI pipeline for a pop-up log's photos. Intended to
// be invoked as a background task (via waitUntil) so the request that
// triggers it can return immediately — large submissions used to blow past
// the Vercel function timeout while the caller waited for analysis.

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

// Re-aggregate the log's completed photos into its summary. When `finalize`
// (or nothing is left to process) it also writes the terminal status so the
// dashboard can stop polling.
async function refreshLogSummary(logId, driverWeightEstimate, finalize) {
  const { data: allPhotos } = await supabaseAdmin
    .from('popup_photos')
    .select('ai_analysis, processing_status')
    .eq('popup_log_id', logId);

  const photos = allPhotos || [];
  const completed = photos.filter(
    (p) => p.processing_status === 'complete' && p.ai_analysis,
  );
  const failed = photos.filter((p) => p.processing_status === 'failed').length;
  const stillPending = photos.filter(
    (p) =>
      p.processing_status === 'processing' || p.processing_status === 'pending',
  ).length;

  const summary = aggregatePhotoAnalyses(
    completed.map((p) => p.ai_analysis),
    driverWeightEstimate,
  );

  const update = {
    ai_category_summary: summary,
    ai_total_weight: summary.total_weight_lbs,
    photo_count: photos.length,
  };

  // Set a terminal status only when finalizing or when nothing is pending.
  if (finalize || stillPending === 0) {
    if (completed.length === 0) update.status = 'failed';
    else if (failed > 0) update.status = 'partial';
    else update.status = 'complete';
    update.processed_at = new Date().toISOString();
  }

  await supabaseAdmin.from('popup_logs').update(update).eq('id', logId);
}

// Analyze every not-yet-complete photo on a log, updating rows and the log
// aggregate as it goes so a polling dashboard sees incremental progress.
export async function analyzeLogPhotos(logId) {
  try {
    const { data: log } = await supabaseAdmin
      .from('popup_logs')
      .select('id, driver_weight_estimate')
      .eq('id', logId)
      .maybeSingle();
    if (!log) return;

    const { data: photoRows } = await supabaseAdmin
      .from('popup_photos')
      .select('id, photo_url, processing_status')
      .eq('popup_log_id', logId)
      .order('photo_order', { ascending: true });

    const pending = (photoRows || []).filter(
      (p) => p.processing_status !== 'complete',
    );

    // Nothing to analyze — just (re)finalize the summary.
    if (pending.length === 0) {
      await refreshLogSummary(logId, log.driver_weight_estimate, true);
      return;
    }

    for (let i = 0; i < pending.length; i += BATCH_SIZE) {
      const batch = pending.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map((p) => analyzeWithRetry(p.photo_url)),
      );

      await Promise.all(
        results.map((result, j) => {
          const row = batch[j];
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

      const isLastBatch = i + BATCH_SIZE >= pending.length;
      await refreshLogSummary(logId, log.driver_weight_estimate, isLastBatch);
      if (!isLastBatch) await sleep(BATCH_DELAY_MS);
    }
  } catch (e) {
    // Mark the log failed so the dashboard stops polling on a hard error.
    await supabaseAdmin
      .from('popup_logs')
      .update({ status: 'failed', processed_at: new Date().toISOString() })
      .eq('id', logId)
      .then(
        () => {},
        () => {},
      );
  }
}

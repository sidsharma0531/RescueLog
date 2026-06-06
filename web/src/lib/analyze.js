import { supabaseAdmin } from './supabase';
import { analyzePopupPhotoFromUrl } from './anthropic';
import { aggregatePhotoAnalyses } from './aggregate';

// SERVER-ONLY. AI pipeline for a pop-up log's photos, processed in small
// sequential batches. There are NO server-to-server self-calls — those get
// blocked/rate-limited inside Vercel's serverless network. Instead:
//   - the upload route drains as many batches as fit in one function's time
//     budget (handles small submissions immediately), and
//   - the dashboard's reliable browser poll drives the remaining batches by
//     calling process-next, one batch per poll.
//
// Resilience: one photo failing never affects the others or stops a batch
// (Promise.allSettled + guarded row updates). Photos only ever move
// processing -> complete/failed, so there are no stuck intermediate states.
// The log's terminal status follows the aggregate: 'failed' only if ALL
// photos failed, 'partial' if some failed, else 'complete'.

// Photos analyzed per batch (in parallel).
export const BATCH_SIZE = 3;

// 429 handling: wait RETRY_DELAY_MS and retry up to MAX_RETRIES times.
const RETRY_DELAY_MS = 5000;
const MAX_RETRIES = 3;

// Statuses that still need analysis.
const PENDING_STATUSES = ['processing', 'pending'];

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

// Count photos still awaiting analysis.
async function countPending(logId) {
  const { count } = await supabaseAdmin
    .from('popup_photos')
    .select('id', { count: 'exact', head: true })
    .eq('popup_log_id', logId)
    .in('processing_status', PENDING_STATUSES);
  return count || 0;
}

// Re-aggregate the log's completed photos into its summary. When `finalize`
// is true, also write the terminal status: 'failed' only if nothing
// completed, 'partial' if some failed, else 'complete'.
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

  const summary = aggregatePhotoAnalyses(
    completed.map((p) => p.ai_analysis),
    driverWeightEstimate,
  );

  const update = {
    ai_category_summary: summary,
    ai_total_weight: summary.total_weight_lbs,
    photo_count: photos.length,
  };

  if (finalize) {
    if (completed.length === 0) update.status = 'failed';
    else if (failed > 0) update.status = 'partial';
    else update.status = 'complete';
    update.processed_at = new Date().toISOString();
  }

  await supabaseAdmin.from('popup_logs').update(update).eq('id', logId);
}

// Process ONE batch (up to BATCH_SIZE pending photos): analyze them, update
// their rows, refresh the aggregate, and finalize the status if nothing is
// left. Returns { remaining, analyzed }. One photo failing never throws out.
export async function processPopupBatch(logId) {
  const { data: log } = await supabaseAdmin
    .from('popup_logs')
    .select('id, driver_weight_estimate')
    .eq('id', logId)
    .maybeSingle();
  if (!log) return { remaining: 0, analyzed: 0 };

  const { data: batch } = await supabaseAdmin
    .from('popup_photos')
    .select('id, photo_url')
    .eq('popup_log_id', logId)
    .in('processing_status', PENDING_STATUSES)
    .order('photo_order', { ascending: true })
    .limit(BATCH_SIZE);

  // Nothing pending — make sure the summary + status are finalized.
  if (!batch || batch.length === 0) {
    await refreshLogSummary(logId, log.driver_weight_estimate, true);
    return { remaining: 0, analyzed: 0 };
  }

  // Analyze each photo independently. allSettled never rejects, so one
  // photo's failure can't stop the others.
  const results = await Promise.allSettled(
    batch.map((p) => analyzeWithRetry(p.photo_url)),
  );

  // Persist each outcome; guard each update so a DB hiccup on one row doesn't
  // abort the rest of the batch.
  await Promise.all(
    results.map(async (result, j) => {
      const row = batch[j];
      try {
        if (result.status === 'fulfilled') {
          await supabaseAdmin
            .from('popup_photos')
            .update({
              ai_analysis: result.value,
              ai_confidence: result.value.overall_confidence ?? null,
              processing_status: 'complete',
              processing_error: null,
            })
            .eq('id', row.id);
        } else {
          console.error(
            `[analyze] photo ${row.id} failed:`,
            result.reason?.message || result.reason,
          );
          await supabaseAdmin
            .from('popup_photos')
            .update({
              processing_status: 'failed',
              processing_error: String(
                result.reason?.message || result.reason || 'AI analysis failed',
              ),
            })
            .eq('id', row.id);
        }
      } catch (e) {
        console.error(
          `[analyze] could not persist photo ${row.id} result:`,
          e?.message || e,
        );
      }
    }),
  );

  const remaining = await countPending(logId);
  await refreshLogSummary(logId, log.driver_weight_estimate, remaining === 0);
  return { remaining, analyzed: batch.length };
}

// Process batches back-to-back until none remain or the time budget runs out.
// Used by the upload route's background task so small submissions finish in a
// single invocation; anything left over is picked up by the dashboard poll.
// Stays well under the 60s function limit.
export async function drainBatches(logId, budgetMs = 50000) {
  const deadline = Date.now() + budgetMs;
  for (;;) {
    let result;
    try {
      result = await processPopupBatch(logId);
    } catch (e) {
      console.error(`[drain] log ${logId}: batch error, stopping:`, e?.message || e);
      return; // leave the rest for the dashboard poll
    }
    if (result.remaining <= 0) {
      console.log(`[drain] log ${logId}: all photos processed`);
      return;
    }
    if (Date.now() > deadline) {
      console.log(
        `[drain] log ${logId}: time budget reached, ${result.remaining} pending left for the dashboard poll`,
      );
      return;
    }
    await sleep(500); // small spacing eases 429 pressure
  }
}

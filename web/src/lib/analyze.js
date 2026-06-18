import { supabaseAdmin } from './supabase';
import { analyzePopupPhotoFromUrl } from './anthropic';
import { aggregatePhotoAnalyses } from './aggregate';
import { applyPriceReferences } from './pricing';
import { orgIdForLog } from './org';

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

// Cart Mode: the cart was weighed on a scale, so the entered scale weight is
// the ground-truth total. Rescale the AI's category weights to sum to it (the
// AI's job is the breakdown; the scale gives the total) and report that as the
// total. No-op when there's no scale weight, so pop-up logs are unchanged.
// Leaves category value_usd untouched — value is the AI's retail estimate,
// independent of the scale-corrected weight.
function applyScaleWeight(summary, scaleWeightLbs) {
  const scale = Number(scaleWeightLbs);
  if (!summary || !Number.isFinite(scale) || scale <= 0) return;

  const aiTotal = summary.total_weight_lbs || 0;
  if (aiTotal > 0) {
    const k = scale / aiTotal;
    summary.categories = (summary.categories || []).map((c) => ({
      ...c,
      weight_lbs: Math.round((c.weight_lbs || 0) * k),
    }));
  }
  const total = (summary.categories || []).reduce(
    (s, c) => s + (c.weight_lbs || 0),
    0,
  );
  summary.categories = (summary.categories || []).map((c) => ({
    ...c,
    percentage: total > 0 ? Math.round(((c.weight_lbs || 0) / total) * 1000) / 10 : 0,
  }));
  summary.total_weight_lbs = Math.round(scale);
  summary.scale_weight_lbs = Math.round(scale);
}

// Load an organization's price references for the value override. Returns []
// when none are set (the common case) or the table is absent, making the
// override a no-op.
async function fetchOrgPriceReferences(organizationId) {
  const { data } = await supabaseAdmin
    .from('price_references')
    .select('item_name, price_usd, unit')
    .eq('organization_id', orgIdForLog(organizationId));
  return data || [];
}

// Re-aggregate the log's completed photos into its summary. When `finalize`
// is true, also write the terminal status: 'failed' only if nothing
// completed, 'partial' if some failed, else 'complete'.
async function refreshLogSummary(
  logId,
  driverWeightEstimate,
  organizationId,
  scaleWeightLbs,
  finalize,
) {
  const { data: allPhotos } = await supabaseAdmin
    .from('popup_photos')
    .select('ai_analysis, processing_status')
    .eq('popup_log_id', logId);

  const photos = allPhotos || [];
  const completed = photos.filter(
    (p) => p.processing_status === 'complete' && p.ai_analysis,
  );
  const failed = photos.filter((p) => p.processing_status === 'failed').length;

  // Apply the org's pinned prices to each photo's analysis before aggregating,
  // so the rolled-up value reflects any overrides.
  const priceRefs = await fetchOrgPriceReferences(organizationId);
  const summary = aggregatePhotoAnalyses(
    completed.map((p) => applyPriceReferences(p.ai_analysis, priceRefs)),
    driverWeightEstimate,
  );
  applyScaleWeight(summary, scaleWeightLbs);

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

  // ai_total_value goes in a separate, best-effort write so photo processing
  // keeps working on databases that predate the column. The value is also
  // embedded in ai_category_summary.total_value_usd, which the UI falls back to.
  const { error: valErr } = await supabaseAdmin
    .from('popup_logs')
    .update({ ai_total_value: summary.total_value_usd })
    .eq('id', logId);
  if (valErr) {
    console.warn('[analyze] ai_total_value not written (column missing?):', valErr.message);
  }
}

// Process ONE batch (up to BATCH_SIZE pending photos): analyze them, update
// their rows, refresh the aggregate, and finalize the status if nothing is
// left. Returns { remaining, analyzed }. One photo failing never throws out.
export async function processPopupBatch(logId) {
  // select('*') so scale_weight_lbs is picked up where present without
  // breaking on databases that predate the Cart Mode migration.
  const { data: log } = await supabaseAdmin
    .from('popup_logs')
    .select('*')
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
    await refreshLogSummary(
      logId,
      log.driver_weight_estimate,
      log.organization_id,
      log.scale_weight_lbs,
      true,
    );
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
  await refreshLogSummary(
    logId,
    log.driver_weight_estimate,
    log.organization_id,
    log.scale_weight_lbs,
    remaining === 0,
  );
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

import { supabaseAdmin } from './supabase';
import { analyzePopupPhotoFromUrl } from './anthropic';
import { aggregatePhotoAnalyses } from './aggregate';

// SERVER-ONLY. AI pipeline for a pop-up log's photos, run as a self-chaining
// queue: each invocation analyzes only ONE batch (up to BATCH_SIZE photos)
// and then triggers the next invocation, so no single Vercel function ever
// approaches the 60s limit no matter how many photos were submitted.
//
// Resilience rules:
//  - One photo failing never affects the others or stops the chain
//    (Promise.allSettled isolates each photo; each row update is guarded).
//  - The chain always advances while pending photos remain, regardless of
//    whether the current batch had errors.
//  - The log only reaches a terminal status via the aggregate: 'failed'
//    only if ALL photos failed, 'partial' if some failed, else 'complete'.
//  - A hop cap bounds pathological loops.

// Photos per invocation. 3 photos (analyzed in parallel) ≈ 15s worst case,
// well under the 60s function ceiling.
export const BATCH_SIZE = 3;

// Safety valve: max number of chained invocations before we give up and
// finalize. A full 40-photo log needs ~14 hops; the headroom covers
// transient re-attempts without letting a stuck chain run forever.
export const MAX_CHAIN_HOPS = 30;

// 429 handling: wait RETRY_DELAY_MS and retry up to MAX_RETRIES times.
const RETRY_DELAY_MS = 5000;
const MAX_RETRIES = 3;

// Statuses that still need analysis. 'failed' photos are terminal — the
// chain does not retry them (analyzeWithRetry already exhausted 429 retries).
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

// Count photos still awaiting analysis. Returns null on a query error so the
// caller can decide how to proceed.
export async function countPendingPhotos(logId) {
  try {
    const { count, error } = await supabaseAdmin
      .from('popup_photos')
      .select('id', { count: 'exact', head: true })
      .eq('popup_log_id', logId)
      .in('processing_status', PENDING_STATUSES);
    if (error) throw error;
    return count || 0;
  } catch (e) {
    console.error(`[analyze] countPendingPhotos failed for log ${logId}:`, e?.message || e);
    return null;
  }
}

// Re-aggregate the log's completed photos into its summary. When `finalize`
// is true it also writes the terminal status, computed from outcomes:
// 'failed' only if nothing completed, 'partial' if some failed, else 'complete'.
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
// their rows, and refresh the aggregate. Returns { remaining, analyzed }.
// One photo failing never throws out of this function.
export async function processPopupBatch(logId) {
  const { data: log } = await supabaseAdmin
    .from('popup_logs')
    .select('id, driver_weight_estimate')
    .eq('id', logId)
    .maybeSingle();
  if (!log) return { remaining: 0, analyzed: 0 };

  const { data: batch, error: batchErr } = await supabaseAdmin
    .from('popup_photos')
    .select('id, photo_url')
    .eq('popup_log_id', logId)
    .in('processing_status', PENDING_STATUSES)
    .order('photo_order', { ascending: true })
    .limit(BATCH_SIZE);
  if (batchErr) throw batchErr;

  // Nothing pending — make sure the summary + status are finalized.
  if (!batch || batch.length === 0) {
    await refreshLogSummary(logId, log.driver_weight_estimate, true);
    return { remaining: 0, analyzed: 0 };
  }

  // Analyze each photo independently. allSettled never rejects, so one
  // photo's failure can't stop the others or throw out of here.
  const results = await Promise.allSettled(
    batch.map((p) => analyzeWithRetry(p.photo_url)),
  );

  // Persist each outcome; guard each update so a DB hiccup on one row
  // doesn't abort the rest of the batch.
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

  const remaining = (await countPendingPhotos(logId)) ?? 0;
  await refreshLogSummary(logId, log.driver_weight_estimate, remaining === 0);
  return { remaining, analyzed: batch.length };
}

// Last resort: mark any still-pending photos failed and finalize the log.
// Used when the chain gives up (hop cap or an untriggerable next link) so the
// dashboard stops polling. Status still follows the all/some/none rule, so a
// log with some successes finalizes as 'partial', not 'failed'.
export async function failRemainingAndFinalize(logId, reason) {
  await supabaseAdmin
    .from('popup_photos')
    .update({
      processing_status: 'failed',
      processing_error: reason || 'Processing stopped',
    })
    .eq('popup_log_id', logId)
    .in('processing_status', PENDING_STATUSES)
    .then(
      () => {},
      () => {},
    );

  const { data: log } = await supabaseAdmin
    .from('popup_logs')
    .select('driver_weight_estimate')
    .eq('id', logId)
    .maybeSingle();
  await refreshLogSummary(logId, log?.driver_weight_estimate, true);
}

// Shared secret for internal self-calls. Falls back to a dev default so the
// chain also works locally without extra setup; set ADMIN_SESSION_SECRET in
// production for real protection.
export function internalSecret() {
  return process.env.ADMIN_SESSION_SECRET || 'dev-insecure-secret-change-me';
}

// Absolute base URL for self-calls. Prefer the origin the request came in on:
// it's a public, reachable URL (the caller just used it) and is not behind
// Vercel Deployment Protection, unlike the deployment-specific VERCEL_URL.
export function baseUrlFrom(request) {
  try {
    return new URL(request.url).origin;
  } catch {
    return process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '';
  }
}

// Trigger the next link in the chain (single attempt). process-next returns
// 202 immediately, so this fetch resolves quickly. Throws on a non-2xx so a
// 401 (Deployment Protection) or 403 (secret) is surfaced rather than
// swallowed — fetch itself only rejects on network errors.
async function triggerProcessNextOnce(baseUrl, logId, attempt) {
  const url = `${baseUrl}/api/popups/${logId}/process-next`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-internal-secret': internalSecret(),
    },
    body: JSON.stringify({ attempt }),
  });
  if (!res.ok) {
    throw new Error(`process-next returned HTTP ${res.status}`);
  }
  return res.status;
}

// Trigger the next link, retrying a few times so a transient hiccup on one
// hop never kills the chain. Returns true if dispatched, false if it
// genuinely couldn't be reached after retries.
export async function triggerNextWithRetry(baseUrl, logId, attempt, tries = 3) {
  const url = `${baseUrl}/api/popups/${logId}/process-next`;
  for (let i = 0; i < tries; i += 1) {
    try {
      const status = await triggerProcessNextOnce(baseUrl, logId, attempt);
      console.log(
        `[chain] triggered process-next (hop ${attempt}) for log ${logId} -> ${status} via ${url}`,
      );
      return true;
    } catch (e) {
      console.error(
        `[chain] trigger attempt ${i + 1}/${tries} failed for log ${logId} via ${url}:`,
        e?.message || e,
      );
      if (i < tries - 1) await sleep(1500);
    }
  }
  return false;
}

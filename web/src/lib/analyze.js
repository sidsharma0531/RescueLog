import { supabaseAdmin } from './supabase';
import { analyzePopupPhotoFromUrl } from './anthropic';
import { aggregatePhotoAnalyses } from './aggregate';

// SERVER-ONLY. AI pipeline for a pop-up log's photos, run as a self-chaining
// queue: each invocation analyzes only ONE batch (up to BATCH_SIZE photos)
// and then triggers the next invocation, so no single Vercel function ever
// approaches the 60s limit no matter how many photos were submitted.

// Photos per invocation. 3 photos (analyzed in parallel) ≈ 15s worst case,
// well under the 60s function ceiling.
export const BATCH_SIZE = 3;

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

// Re-aggregate the log's completed photos into its summary. When `finalize`
// is true it also writes the terminal status so the dashboard stops polling.
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

// Process ONE batch (up to BATCH_SIZE pending photos) for a log: analyze
// them, update their rows, and refresh the aggregate. Returns { done } —
// done=true means no photos remain and the log has been finalized; done=false
// means the caller should trigger the next link in the chain.
export async function processPopupBatch(logId) {
  const { data: log } = await supabaseAdmin
    .from('popup_logs')
    .select('id, driver_weight_estimate')
    .eq('id', logId)
    .maybeSingle();
  if (!log) return { done: true };

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
    return { done: true };
  }

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

  // Any photos left to process after this batch?
  const { count: remaining } = await supabaseAdmin
    .from('popup_photos')
    .select('id', { count: 'exact', head: true })
    .eq('popup_log_id', logId)
    .in('processing_status', PENDING_STATUSES);

  const done = !remaining || remaining === 0;
  await refreshLogSummary(logId, log.driver_weight_estimate, done);
  return { done };
}

// Mark a log failed (used when a batch throws) so polling stops.
export async function markLogFailed(logId) {
  await supabaseAdmin
    .from('popup_logs')
    .update({ status: 'failed', processed_at: new Date().toISOString() })
    .eq('id', logId)
    .then(
      () => {},
      () => {},
    );
}

// Shared secret for internal self-calls. Falls back to a dev default so the
// chain also works locally without extra setup; set ADMIN_SESSION_SECRET in
// production for real protection.
export function internalSecret() {
  return process.env.ADMIN_SESSION_SECRET || 'dev-insecure-secret-change-me';
}

// Absolute base URL for self-calls. Prefer the origin the request came in on:
// it's a public, reachable URL (the caller just used it) and is not behind
// Vercel Deployment Protection, unlike the deployment-specific VERCEL_URL —
// self-calls to a protected VERCEL_URL silently get a 401 auth page instead
// of reaching the function. Fall back to VERCEL_URL only if request.url can't
// be parsed.
export function baseUrlFrom(request) {
  try {
    return new URL(request.url).origin;
  } catch {
    return process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '';
  }
}

// Trigger the next link in the chain. process-next returns 202 immediately
// (it does its work in the background), so this fetch resolves quickly.
export async function triggerProcessNext(baseUrl, logId) {
  const url = `${baseUrl}/api/popups/${logId}/process-next`;
  console.log(`[chain] triggering process-next: ${url}`);
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-internal-secret': internalSecret(),
    },
  });
  console.log(`[chain] process-next responded ${res.status} for log ${logId}`);
  // fetch only rejects on network errors, NOT on HTTP error statuses, so a
  // 401 (Deployment Protection) or 403 (secret check) would otherwise pass
  // silently. Throw so the caller logs it.
  if (!res.ok) {
    throw new Error(`process-next returned HTTP ${res.status}`);
  }
}

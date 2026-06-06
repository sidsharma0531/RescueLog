import { NextResponse } from 'next/server';
import { waitUntil } from '@vercel/functions';
import {
  processPopupBatch,
  countPendingPhotos,
  failRemainingAndFinalize,
  baseUrlFrom,
  triggerNextWithRetry,
  internalSecret,
  MAX_CHAIN_HOPS,
} from '@/lib/analyze';

export const dynamic = 'force-dynamic';
// Each invocation only analyzes one small batch, so it returns fast and
// stays far under the 60s function limit.
export const maxDuration = 60;

// Run work after the HTTP response. On Vercel, waitUntil keeps the function
// alive until the promise settles; off-Vercel (local dev) it may throw, and
// the promise simply runs detached, which is fine.
function runInBackground(promise) {
  promise.catch(() => {});
  try {
    waitUntil(promise);
  } catch {
    /* not on Vercel */
  }
}

// POST /api/popups/[id]/process-next   body: { attempt?: number }
//
// One link in the self-chaining analysis queue. Analyzes the next batch of
// up to 3 pending photos, then — as long as ANY pending photos remain
// (regardless of whether this batch had failures) — triggers the next link.
// A single photo failing is recorded on that photo only and never stops the
// chain. The log reaches a terminal status only via the aggregate
// (complete / partial / failed).
export async function POST(request, { params }) {
  const { id: logId } = params;

  // Only internal callers (the upload route and the chain itself) may
  // trigger analysis.
  const secretOk =
    request.headers.get('x-internal-secret') === internalSecret();
  const body = await request.json().catch(() => ({}));
  const attempt = Number(body?.attempt) || 0;
  console.log(
    `[process-next] log ${logId}: hop ${attempt}; secret check ${
      secretOk ? 'PASSED' : 'FAILED'
    }`,
  );
  if (!secretOk) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  const baseUrl = baseUrlFrom(request);

  runInBackground(
    (async () => {
      // Analyze one batch. A batch-level error (e.g. a transient Supabase
      // failure) must NOT fail the whole log — log it and keep going; the
      // unprocessed photos are still pending and get retried by the next hop.
      let remaining;
      try {
        const result = await processPopupBatch(logId);
        remaining = result.remaining;
        console.log(
          `[process-next] log ${logId}: analyzed ${result.analyzed}, ${remaining} pending remain`,
        );
      } catch (e) {
        console.error(
          `[process-next] log ${logId}: batch error (continuing):`,
          e?.message || e,
        );
        const count = await countPendingPhotos(logId);
        // Unknown count → assume work remains; the hop cap bounds it.
        remaining = count == null ? 1 : count;
      }

      if (remaining <= 0) {
        console.log(`[process-next] log ${logId}: done — no pending photos remain`);
        return;
      }

      // Bound pathological loops.
      if (attempt + 1 >= MAX_CHAIN_HOPS) {
        console.error(
          `[process-next] log ${logId}: CHAIN STOPPED — reached hop cap ${MAX_CHAIN_HOPS} with ${remaining} pending; finalizing`,
        );
        await failRemainingAndFinalize(
          logId,
          `Processing stopped after ${MAX_CHAIN_HOPS} hops`,
        );
        return;
      }

      // Always advance the chain while photos remain. Retries absorb a
      // transient hiccup on the hop so it doesn't kill the chain.
      const triggered = await triggerNextWithRetry(baseUrl, logId, attempt + 1);
      if (!triggered) {
        console.error(
          `[process-next] log ${logId}: CHAIN STOPPED — could not trigger next link after retries; ${remaining} pending. Finalizing as partial.`,
        );
        await failRemainingAndFinalize(
          logId,
          'Processing stopped — next link unreachable',
        );
      }
    })(),
  );

  return NextResponse.json({ status: 'processing' }, { status: 202 });
}

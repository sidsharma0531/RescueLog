import { NextResponse } from 'next/server';
import { waitUntil } from '@vercel/functions';
import {
  processPopupBatch,
  markLogFailed,
  baseUrlFrom,
  triggerProcessNext,
  internalSecret,
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

// POST /api/popups/[id]/process-next
//
// One link in the self-chaining analysis queue. Analyzes the next batch of
// up to 3 pending photos, then — if any remain — fire-and-forget triggers
// itself again so the current invocation returns immediately. When no
// pending photos remain it finalizes the log status. This keeps every
// invocation short (~15s) regardless of how many photos were submitted.
export async function POST(request, { params }) {
  const { id: logId } = params;

  // Only internal callers (the upload route and the chain itself) may
  // trigger analysis.
  if (request.headers.get('x-internal-secret') !== internalSecret()) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  const baseUrl = baseUrlFrom(request);

  runInBackground(
    (async () => {
      try {
        const { done } = await processPopupBatch(logId);
        if (!done) {
          // More photos remain — hand off to the next invocation. We await
          // the trigger (process-next returns 202 immediately) only to make
          // sure the request is dispatched before this function ends.
          await triggerProcessNext(baseUrl, logId);
        }
      } catch (e) {
        await markLogFailed(logId);
      }
    })(),
  );

  return NextResponse.json({ status: 'processing' }, { status: 202 });
}

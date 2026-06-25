import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { processPopupBatch } from '@/lib/analyze';

export const dynamic = 'force-dynamic';
// Processes only one small batch, so it returns well under the 60s limit.
export const maxDuration = 60;

// POST /api/popups/[id]/progress
//
// Lightweight sibling of process-next for the MOBILE app to poll after an
// upload. It drives one batch of analysis (so a large upload finishes even if
// no dashboard is open) and returns ONLY counts — no photo payload — so a phone
// can poll it cheaply. `done`/`total` give a progress bar; `status` is the
// derived terminal state.
export async function POST(request, { params }) {
  const { id: logId } = params;

  // Drive one batch. Never fail the request on a batch error — return the
  // current counts so the poll keeps going and retries the rest.
  try {
    await processPopupBatch(logId);
  } catch (e) {
    console.error(
      `[progress] log ${logId}: batch error (will retry next poll):`,
      e?.message || e,
    );
  }

  try {
    const { data: rows, error } = await supabaseAdmin
      .from('popup_photos')
      .select('processing_status')
      .eq('popup_log_id', logId);
    if (error) throw error;

    const photos = rows || [];
    const total = photos.length;
    const completed = photos.filter((p) => p.processing_status === 'complete').length;
    const failed = photos.filter((p) => p.processing_status === 'failed').length;
    const done = completed + failed;
    const pending = total - done;
    // Mirrors the terminal-status logic in analyze.js refreshLogSummary.
    const status =
      total === 0 || pending > 0
        ? 'processing'
        : completed === 0
          ? 'failed'
          : failed > 0
            ? 'partial'
            : 'complete';

    return NextResponse.json({ status, total, completed, failed, done, pending });
  } catch (e) {
    return NextResponse.json(
      { error: e.message || 'Could not load progress.' },
      { status: 500 },
    );
  }
}

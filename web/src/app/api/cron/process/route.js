import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { drainBatches } from '@/lib/analyze';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Total time to spend per cron run, and per log, leaving headroom under the
// 60s function limit.
const TOTAL_BUDGET_MS = 50000;
const PER_LOG_BUDGET_MS = 20000;
const MAX_LOGS_PER_RUN = 10;

// GET /api/cron/process — Vercel Cron backstop.
//
// Advances any logs still in 'processing' so large submissions finish even
// when nobody has the dashboard detail page open. Each run drains batches for
// up to a few processing logs within a time budget. Idempotent and safe to
// overlap with the dashboard poll / upload drain (photos only move
// processing -> complete/failed).
export async function GET(request) {
  // Vercel sends CRON_SECRET as a Bearer token on cron runs. Fail closed:
  // if the secret is unset or the header doesn't match, reject — otherwise a
  // stranger could trigger a full processing sweep (Anthropic vision calls) on
  // demand. CRON_SECRET MUST be set in the Vercel project env.
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    if (!secret) console.error('[cron] CRON_SECRET is not set — refusing to run.');
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  try {
    const { data: logs, error } = await supabaseAdmin
      .from('popup_logs')
      .select('id')
      .eq('status', 'processing')
      .order('logged_at', { ascending: true })
      .limit(MAX_LOGS_PER_RUN);
    if (error) throw error;

    const deadline = Date.now() + TOTAL_BUDGET_MS;
    let advanced = 0;
    for (const log of logs || []) {
      if (Date.now() >= deadline) break;
      const budget = Math.min(PER_LOG_BUDGET_MS, deadline - Date.now());
      try {
        await drainBatches(log.id, budget);
        advanced += 1;
      } catch (e) {
        console.error(`[cron] error advancing log ${log.id}:`, e?.message || e);
      }
    }

    console.log(
      `[cron] ${(logs || []).length} processing log(s) found; advanced ${advanced}`,
    );
    return NextResponse.json({
      ok: true,
      processing_logs: (logs || []).length,
      advanced,
    });
  } catch (e) {
    console.error('[cron] failed:', e?.message || e);
    return NextResponse.json(
      { error: e.message || 'Cron failed.' },
      { status: 500 },
    );
  }
}

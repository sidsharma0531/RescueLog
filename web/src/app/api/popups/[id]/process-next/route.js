import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { processPopupBatch } from '@/lib/analyze';

export const dynamic = 'force-dynamic';
// Processes only one small batch, so it returns well under the 60s limit.
export const maxDuration = 60;

const POPUP_SELECT =
  '*, driver:drivers(id, name), location:locations(id, name, address)';

// POST /api/popups/[id]/process-next
//
// Client-driven: the dashboard detail page calls this on each poll while a
// log is still processing. It analyzes the next batch of up to 3 pending
// photos and returns the current log (with photos) so the poll can render
// progress. The browser poll is the chain driver — there are no
// server-to-server self-calls, which the Vercel serverless network blocks.
export async function POST(request, { params }) {
  const { id: logId } = params;

  // Analyze one batch. Never fail the request on a batch error — return the
  // current state so the poll keeps driving and retries the rest.
  try {
    const { analyzed, remaining } = await processPopupBatch(logId);
    console.log(
      `[process-next] log ${logId}: analyzed ${analyzed}, ${remaining} pending remain`,
    );
  } catch (e) {
    console.error(
      `[process-next] log ${logId}: batch error (will retry next poll):`,
      e?.message || e,
    );
  }

  try {
    const { data: popup, error } = await supabaseAdmin
      .from('popup_logs')
      .select(POPUP_SELECT)
      .eq('id', logId)
      .maybeSingle();
    if (error) throw error;
    if (!popup) {
      return NextResponse.json(
        { error: 'Pop-up log not found.' },
        { status: 404 },
      );
    }

    const { data: photos } = await supabaseAdmin
      .from('popup_photos')
      .select('*')
      .eq('popup_log_id', logId)
      .order('photo_order', { ascending: true });

    return NextResponse.json({ popup: { ...popup, photos: photos || [] } });
  } catch (e) {
    return NextResponse.json(
      { error: e.message || 'Could not process photos.' },
      { status: 500 },
    );
  }
}

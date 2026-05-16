'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { apiGet } from '@/lib/api-client';
import { categoryLabel } from '@/lib/categories';
import { formatDateTime, formatLbs, formatConfidence } from '@/lib/format';
import Card from '@/components/Card';
import CategoryChart from '@/components/CategoryChart';
import PhotoGallery from '@/components/PhotoGallery';
import StatusBadge from '@/components/StatusBadge';
import { LoadingBlock, ErrorBlock } from '@/components/Loading';

export default function PopupDetailPage() {
  const { id } = useParams();
  const [popup, setPopup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const d = await apiGet(`/api/popups/${id}`);
      setPopup(d.popup);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <LoadingBlock label="Loading pop-up…" />;
  if (error) return <ErrorBlock message={error} onRetry={load} />;
  if (!popup) return <ErrorBlock message="Pop-up not found." />;

  const locationName =
    popup.location?.name || popup.location_name_manual || 'Unknown site';
  const summary = popup.ai_category_summary || {};
  const aiW = popup.ai_total_weight;
  const drvW = popup.driver_weight_estimate;
  let diffPct = summary.estimate_difference_pct;
  if (diffPct == null && aiW != null && drvW) {
    diffPct = Math.round(((aiW - drvW) / drvW) * 1000) / 10;
  }

  return (
    <div className="space-y-5">
      <a
        href="/dashboard/popups"
        className="text-sm font-medium text-rescue-green hover:underline"
      >
        ← All pop-up logs
      </a>

      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-bold text-rescue-ink">{locationName}</h1>
          <StatusBadge status={popup.status} />
        </div>
        <p className="text-sm text-gray-500">
          {formatDateTime(popup.logged_at)} · Logged by{' '}
          {popup.driver?.name || 'Unknown driver'}
        </p>
      </div>

      {popup.status === 'processing' && (
        <div className="flex items-center justify-between rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <span>AI analysis is still processing.</span>
          <button onClick={load} className="font-semibold underline">
            Refresh
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <CompareCard
          label="AI estimate"
          value={aiW != null ? formatLbs(aiW) : '—'}
          accent="green"
        />
        <CompareCard
          label="Driver estimate"
          value={drvW != null ? formatLbs(drvW) : 'Not provided'}
          accent="gray"
        />
        <CompareCard
          label="Difference"
          value={diffPct != null ? `${diffPct > 0 ? '+' : ''}${diffPct}%` : '—'}
          sub={diffPct != null ? 'AI vs. driver' : 'Needs both estimates'}
          accent="orange"
        />
      </div>

      <Card title="AI category breakdown">
        <CategoryChart data={summary.categories} variant="bars" />
        {summary.overall_confidence != null && (
          <p className="mt-4 text-xs text-gray-400">
            Overall AI confidence: {formatConfidence(summary.overall_confidence)}
          </p>
        )}
      </Card>

      <Card title={`Photos (${popup.photos?.length || 0})`}>
        <PhotoGallery photos={popup.photos} />
      </Card>

      <Card title="Per-photo AI analysis">
        {(popup.photos || []).length === 0 ? (
          <p className="text-sm text-gray-400">No photos.</p>
        ) : (
          <div className="space-y-2">
            {popup.photos.map((photo, i) => (
              <PhotoAnalysis key={photo.id} photo={photo} index={i} />
            ))}
          </div>
        )}
      </Card>

      {popup.notes && (
        <Card title="Driver notes">
          <p className="text-sm text-gray-600">{popup.notes}</p>
        </Card>
      )}

      {summary.categories && (
        <Card title="Raw AI data">
          <details>
            <summary className="cursor-pointer text-sm text-gray-500">
              Show aggregated JSON
            </summary>
            <pre className="thin-scroll mt-2 overflow-x-auto rounded-lg bg-gray-50 p-3 text-xs text-gray-700">
              {JSON.stringify(summary, null, 2)}
            </pre>
          </details>
        </Card>
      )}
    </div>
  );
}

function CompareCard({ label, value, sub, accent }) {
  const colors = {
    green: 'text-rescue-green',
    orange: 'text-rescue-orange',
    gray: 'text-gray-500',
  };
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
        {label}
      </p>
      <p className={`mt-1 text-2xl font-bold ${colors[accent] || 'text-rescue-ink'}`}>
        {value}
      </p>
      {sub && <p className="mt-0.5 text-xs text-gray-400">{sub}</p>}
    </div>
  );
}

function PhotoAnalysis({ photo, index }) {
  const a = photo.ai_analysis;
  const failed = photo.processing_status === 'failed';

  let summaryText = ' — pending';
  if (failed) summaryText = ' — AI analysis failed';
  else if (a)
    summaryText = ` — ${formatLbs(a.total_estimated_weight_lbs)}, ${formatConfidence(
      a.overall_confidence,
    )} confidence`;

  return (
    <details className="rounded-xl border border-gray-200 p-3">
      <summary className="cursor-pointer text-sm font-medium text-rescue-ink">
        Photo {index + 1}
        <span className="font-normal text-gray-500">{summaryText}</span>
      </summary>
      <div className="mt-3 flex flex-col gap-3 sm:flex-row">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo.photo_url}
          alt={`Pop-up photo ${index + 1}`}
          className="h-32 w-32 shrink-0 rounded-lg object-cover"
        />
        <div className="flex-1 text-sm">
          {failed && (
            <p className="text-red-600">
              {photo.processing_error || 'Analysis failed.'}
            </p>
          )}
          {a && (
            <>
              <ul className="space-y-1">
                {(a.categories || []).map((c, ci) => (
                  <li key={ci} className="text-gray-700">
                    <span className="font-medium">{categoryLabel(c.name)}</span>
                    {' — '}
                    {formatLbs(c.estimated_weight_lbs)}
                    {c.items?.length ? (
                      <span className="text-gray-400"> · {c.items.join(', ')}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
              {a.notable_items?.length > 0 && (
                <p className="mt-2 text-gray-500">
                  <span className="font-medium">Notable:</span>{' '}
                  {a.notable_items.join('; ')}
                </p>
              )}
              {a.notes && <p className="mt-1 text-gray-400">{a.notes}</p>}
              <p className="mt-1 text-xs text-gray-400">
                Image quality: {a.image_quality}
              </p>
            </>
          )}
        </div>
      </div>
    </details>
  );
}

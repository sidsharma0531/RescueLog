'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api-client';
import { categoryLabel } from '@/lib/categories';
import { formatDateTime, formatLbs, formatUsd, formatConfidence } from '@/lib/format';
import Card from '@/components/Card';
import CategoryChart from '@/components/CategoryChart';
import PhotoGallery from '@/components/PhotoGallery';
import StatusBadge from '@/components/StatusBadge';
import { LoadingBlock, ErrorBlock } from '@/components/Loading';

export default function PopupDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [popup, setPopup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [nameError, setNameError] = useState('');
  const [editingDate, setEditingDate] = useState(false);
  const [dateDraft, setDateDraft] = useState('');
  const [savingDate, setSavingDate] = useState(false);
  const [dateError, setDateError] = useState('');
  const [addingEstimate, setAddingEstimate] = useState(false);
  const [estimateDraft, setEstimateDraft] = useState('');
  const [savingEstimate, setSavingEstimate] = useState(false);
  const [estimateError, setEstimateError] = useState('');

  function startAddEstimate() {
    setEstimateDraft('');
    setEstimateError('');
    setAddingEstimate(true);
  }

  async function saveEstimate() {
    const lbs = Number(estimateDraft);
    if (estimateDraft === '' || Number.isNaN(lbs) || lbs < 0) {
      setEstimateError('Enter a weight in lbs.');
      return;
    }
    setSavingEstimate(true);
    setEstimateError('');
    try {
      await apiPatch(`/api/popups/${id}`, { manual_estimate_lbs: lbs });
      setPopup((p) => ({ ...p, manual_estimate_lbs: lbs }));
      setAddingEstimate(false);
    } catch (e) {
      setEstimateError(e.message);
    } finally {
      setSavingEstimate(false);
    }
  }

  // ISO timestamp -> the local "YYYY-MM-DDTHH:mm" a datetime-local input wants.
  function toDateTimeLocal(iso) {
    const d = iso ? new Date(iso) : new Date();
    if (Number.isNaN(d.getTime())) return '';
    const pad = (n) => String(n).padStart(2, '0');
    return (
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
      `T${pad(d.getHours())}:${pad(d.getMinutes())}`
    );
  }

  function startEditDate() {
    setDateDraft(toDateTimeLocal(popup.logged_at));
    setDateError('');
    setEditingDate(true);
  }

  async function saveDate() {
    if (!dateDraft) {
      setDateError('Pick a date and time.');
      return;
    }
    // dateDraft is local time; new Date() reads it in the browser's tz and
    // toISOString() normalizes to UTC for storage.
    const when = new Date(dateDraft);
    if (Number.isNaN(when.getTime())) {
      setDateError('Invalid date and time.');
      return;
    }
    const iso = when.toISOString();
    setSavingDate(true);
    setDateError('');
    try {
      await apiPatch(`/api/popups/${id}`, { logged_at: iso });
      setPopup((p) => ({ ...p, logged_at: iso }));
      setEditingDate(false);
    } catch (e) {
      setDateError(e.message);
    } finally {
      setSavingDate(false);
    }
  }

  function startEditName() {
    setNameDraft(
      popup.location_name_manual || popup.location?.name || '',
    );
    setNameError('');
    setEditingName(true);
  }

  async function saveName() {
    const name = nameDraft.trim();
    if (!name) {
      setNameError('Enter a location name.');
      return;
    }
    setSavingName(true);
    setNameError('');
    try {
      await apiPatch(`/api/popups/${id}`, { location_name: name });
      setPopup((p) => ({ ...p, location_name_manual: name }));
      setEditingName(false);
    } catch (e) {
      setNameError(e.message);
    } finally {
      setSavingName(false);
    }
  }

  async function handleDelete() {
    if (deleting) return;
    const ok = window.confirm(
      'Are you sure you want to delete this log? This cannot be undone.',
    );
    if (!ok) return;
    setDeleteError('');
    setDeleting(true);
    try {
      await apiDelete(`/api/popups/${id}`);
      router.push('/dashboard/popups');
    } catch (e) {
      setDeleteError(e.message);
      setDeleting(false);
    }
  }

  // `silent` refreshes (used by polling) don't toggle the full-page
  // spinner or surface transient errors.
  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      setError('');
      try {
        const d = await apiGet(`/api/popups/${id}`);
        setPopup(d.popup);
      } catch (e) {
        if (!silent) setError(e.message);
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [id],
  );

  useEffect(() => {
    load();
  }, [load]);

  // While the AI is still processing, this poll IS the processing driver:
  // each tick calls process-next, which analyzes the next batch of up to 3
  // pending photos and returns the updated log. Ticks run sequentially (the
  // next is scheduled only after the previous returns) so a single tab never
  // overlaps itself. Stops when the log reaches a terminal status.
  useEffect(() => {
    if (popup?.status !== 'processing') return undefined;
    let cancelled = false;
    let timer;
    const tick = async () => {
      try {
        const d = await apiPost(`/api/popups/${id}/process-next`, {});
        if (cancelled) return;
        if (d.popup) setPopup(d.popup);
        if (!cancelled && d.popup?.status === 'processing') {
          timer = setTimeout(tick, 4000);
        }
      } catch {
        if (!cancelled) timer = setTimeout(tick, 5000); // retry on transient error
      }
    };
    timer = setTimeout(tick, 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [popup?.status, id]);

  if (loading) return <LoadingBlock label="Loading pop-up…" />;
  if (error) return <ErrorBlock message={error} onRetry={load} />;
  if (!popup) return <ErrorBlock message="Pop-up not found." />;

  // Prefer a manually-saved name so an edit is reflected even when the log
  // is also linked to a GPS location record.
  const locationName =
    popup.location_name_manual || popup.location?.name || 'Unknown site';
  const summary = popup.ai_category_summary || {};
  const aiW = popup.ai_total_weight;
  const aiValue = popup.ai_total_value ?? summary.total_value_usd ?? null;
  // Comparison estimate: the driver's app estimate if present, otherwise an
  // admin-entered manual reference. Only when one exists do we show the
  // comparison + difference boxes.
  const driverW = popup.driver_weight_estimate;
  const manualW = popup.manual_estimate_lbs;
  const comparisonW = driverW != null ? driverW : manualW != null ? manualW : null;
  const comparisonIsManual = driverW == null && manualW != null;
  const hasComparison = comparisonW != null;
  let lbDiff = null;
  let pctDiff = null;
  if (hasComparison && aiW != null) {
    lbDiff = Math.round(aiW - comparisonW);
    pctDiff =
      comparisonW !== 0
        ? Math.round(((aiW - comparisonW) / comparisonW) * 1000) / 10
        : null;
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
          {editingName ? (
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveName();
                  if (e.key === 'Escape') setEditingName(false);
                }}
                autoFocus
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-lg font-bold text-rescue-ink outline-none focus:border-rescue-green focus:ring-1 focus:ring-rescue-green"
              />
              <button
                onClick={saveName}
                disabled={savingName}
                className="rounded-lg bg-rescue-green px-3 py-1.5 text-sm font-semibold text-white hover:bg-rescue-green-dark disabled:opacity-60"
              >
                {savingName ? 'Saving…' : 'Save'}
              </button>
              <button
                onClick={() => setEditingName(false)}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          ) : (
            <>
              <h1 className="text-xl font-bold text-rescue-ink">
                {locationName}
              </h1>
              <button
                onClick={startEditName}
                title="Edit location name"
                aria-label="Edit location name"
                className="rounded-md p-1 text-gray-400 transition hover:bg-gray-100 hover:text-rescue-green"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M4 20h4l10.5-10.5a2.121 2.121 0 00-3-3L5 17v3z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </>
          )}
          <StatusBadge status={popup.status} />
        </div>
        {nameError && <p className="mt-1 text-sm text-red-600">{nameError}</p>}
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-gray-500">
          {editingDate ? (
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="datetime-local"
                value={dateDraft}
                onChange={(e) => setDateDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveDate();
                  if (e.key === 'Escape') setEditingDate(false);
                }}
                autoFocus
                className="rounded-lg border border-gray-300 px-2.5 py-1 text-sm text-rescue-ink outline-none focus:border-rescue-green focus:ring-1 focus:ring-rescue-green"
              />
              <button
                onClick={saveDate}
                disabled={savingDate}
                className="rounded-lg bg-rescue-green px-3 py-1 text-xs font-semibold text-white hover:bg-rescue-green-dark disabled:opacity-60"
              >
                {savingDate ? 'Saving…' : 'Save'}
              </button>
              <button
                onClick={() => setEditingDate(false)}
                className="rounded-lg border border-gray-300 px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          ) : (
            <span className="inline-flex items-center gap-1.5">
              {formatDateTime(popup.logged_at)}
              <button
                onClick={startEditDate}
                title="Edit date & time"
                aria-label="Edit date and time"
                className="rounded-md p-0.5 text-gray-400 transition hover:bg-gray-100 hover:text-rescue-green"
              >
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M4 20h4l10.5-10.5a2.121 2.121 0 00-3-3L5 17v3z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </span>
          )}
          <span>· Logged by {popup.driver?.name || 'Unknown driver'}</span>
        </div>
        {dateError && <p className="mt-1 text-sm text-red-600">{dateError}</p>}
      </div>

      {popup.status === 'processing' && (
        <div className="flex items-center justify-between rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <span>AI analysis is still processing — this updates automatically.</span>
          <button onClick={() => load(true)} className="font-semibold underline">
            Refresh now
          </button>
        </div>
      )}

      {hasComparison ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <CompareCard
            label="AI estimate"
            value={aiW != null ? formatLbs(aiW) : '—'}
            accent="green"
          />
          <CompareCard
            label={comparisonIsManual ? 'Reference estimate' : 'Driver estimate'}
            value={formatLbs(comparisonW)}
            sub={comparisonIsManual ? 'Manually entered' : "Driver's app estimate"}
            accent="gray"
          />
          <CompareCard
            label="Difference"
            value={
              lbDiff != null
                ? `${lbDiff > 0 ? '+' : ''}${formatLbs(lbDiff)}`
                : '—'
            }
            sub={
              pctDiff != null
                ? `${pctDiff > 0 ? '+' : ''}${pctDiff}% vs ${
                    comparisonIsManual ? 'reference' : 'driver'
                  }`
                : 'AI vs. estimate'
            }
            accent="orange"
          />
        </div>
      ) : (
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                AI estimated weight
              </p>
              <p className="mt-1 text-3xl font-bold text-rescue-green">
                {aiW != null ? formatLbs(aiW) : '—'}
              </p>
            </div>
            {!addingEstimate && (
              <button
                onClick={startAddEstimate}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition hover:border-rescue-green hover:text-rescue-green"
              >
                Add comparison estimate
              </button>
            )}
          </div>

          {addingEstimate && (
            <div className="mt-4 border-t border-gray-100 pt-4">
              <label className="block text-sm font-medium text-gray-700">
                Reference weight (lbs)
              </label>
              <p className="mb-2 text-xs text-gray-400">
                e.g. the number your paper process recorded — we&apos;ll
                compare it against the AI estimate.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  value={estimateDraft}
                  onChange={(e) => setEstimateDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveEstimate();
                    if (e.key === 'Escape') setAddingEstimate(false);
                  }}
                  autoFocus
                  placeholder="lbs"
                  className="w-32 rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-rescue-green focus:ring-1 focus:ring-rescue-green"
                />
                <button
                  onClick={saveEstimate}
                  disabled={savingEstimate}
                  className="rounded-lg bg-rescue-green px-4 py-2 text-sm font-semibold text-white hover:bg-rescue-green-dark disabled:opacity-60"
                >
                  {savingEstimate ? 'Saving…' : 'Save'}
                </button>
                <button
                  onClick={() => setAddingEstimate(false)}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
              {estimateError && (
                <p className="mt-2 text-sm text-red-600">{estimateError}</p>
              )}
            </div>
          )}
        </div>
      )}

      {aiValue != null && aiValue > 0 && (
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            Est. Retail Value
          </p>
          <p className="mt-1 text-3xl font-bold text-rescue-green">
            {formatUsd(aiValue)}
          </p>
          <p className="mt-0.5 text-xs text-gray-400">
            Estimated retail value of the rescued food
          </p>
        </div>
      )}

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

      <div className="pt-2">
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700 disabled:opacity-60"
        >
          {deleting ? 'Deleting…' : 'Delete Log'}
        </button>
        {deleteError && (
          <p className="mt-2 text-sm text-red-700">{deleteError}</p>
        )}
      </div>
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
    summaryText = ` — ${formatLbs(a.total_estimated_weight_lbs)} · ${formatUsd(
      a.total_estimated_value_usd,
    )} · ${formatConfidence(a.overall_confidence)} confidence`;

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
                    {c.estimated_value_usd > 0 && (
                      <span className="font-medium text-rescue-green">
                        {' · '}
                        {formatUsd(c.estimated_value_usd)}
                      </span>
                    )}
                    {c.items?.length ? (
                      <span className="text-gray-400">
                        {' · '}
                        {c.items
                          .map((it) => (typeof it === 'string' ? it : it.name))
                          .filter(Boolean)
                          .join(', ')}
                      </span>
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

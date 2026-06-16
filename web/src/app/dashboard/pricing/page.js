'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api-client';
import { formatUsd } from '@/lib/format';
import Card from '@/components/Card';
import { LoadingBlock, ErrorBlock } from '@/components/Loading';

const UNIT_LABEL = { per_unit: 'each', per_lb: 'per lb' };

export default function PricingPage() {
  const [refs, setRefs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Add-form state
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [unit, setUnit] = useState('per_unit');
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const d = await apiGet('/api/price-references');
      setRefs(d.price_references || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function add() {
    const item_name = name.trim();
    const price_usd = Number(price);
    if (!item_name) return setAddError('Enter an item name.');
    if (!Number.isFinite(price_usd) || price_usd < 0) {
      return setAddError('Enter a valid price.');
    }
    setAdding(true);
    setAddError('');
    try {
      const d = await apiPost('/api/price-references', { item_name, price_usd, unit });
      setRefs((r) =>
        [...r, d.price_reference].sort((a, b) =>
          a.item_name.localeCompare(b.item_name),
        ),
      );
      setName('');
      setPrice('');
      setUnit('per_unit');
    } catch (e) {
      setAddError(e.message);
    } finally {
      setAdding(false);
    }
  }

  async function remove(id) {
    if (!window.confirm('Delete this pinned price?')) return;
    const prev = refs;
    setRefs((r) => r.filter((x) => x.id !== id)); // optimistic
    try {
      await apiDelete(`/api/price-references/${id}`);
    } catch (e) {
      setRefs(prev); // revert on failure
      window.alert(e.message);
    }
  }

  function patchLocal(updated) {
    setRefs((r) =>
      r
        .map((x) => (x.id === updated.id ? updated : x))
        .sort((a, b) => a.item_name.localeCompare(b.item_name)),
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-rescue-ink">Pricing</h1>
        <p className="text-sm text-gray-500">
          Pin an exact retail price for items you receive repeatedly. A pinned
          price overrides the AI&apos;s estimated value for matching items on
          new analyses.
        </p>
      </div>

      <Card title="Add a pinned price">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
              Item name
            </span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && add()}
              placeholder="e.g. Antone's po-boy"
              className="w-56 rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-rescue-green focus:ring-1 focus:ring-rescue-green"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
              Price (USD)
            </span>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && add()}
              placeholder="9.00"
              className="w-28 rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-rescue-green focus:ring-1 focus:ring-rescue-green"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
              Unit
            </span>
            <select
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-rescue-green focus:ring-1 focus:ring-rescue-green"
            >
              <option value="per_unit">each (per unit)</option>
              <option value="per_lb">per lb</option>
            </select>
          </label>
          <button
            onClick={add}
            disabled={adding}
            className="rounded-lg bg-rescue-green px-4 py-2 text-sm font-semibold text-white transition hover:bg-rescue-green-dark disabled:opacity-60"
          >
            {adding ? 'Adding…' : 'Add'}
          </button>
        </div>
        {addError && <p className="mt-2 text-sm text-red-600">{addError}</p>}
      </Card>

      {loading ? (
        <LoadingBlock label="Loading prices…" />
      ) : error ? (
        <ErrorBlock message={error} onRetry={load} />
      ) : (
        <Card title={`Pinned prices (${refs.length})`}>
          {refs.length === 0 ? (
            <p className="text-sm text-gray-400">
              No pinned prices yet. Items you don&apos;t pin keep the AI&apos;s
              estimated retail value.
            </p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {refs.map((r) => (
                <PriceRow
                  key={r.id}
                  row={r}
                  onSaved={patchLocal}
                  onDelete={() => remove(r.id)}
                />
              ))}
            </ul>
          )}
        </Card>
      )}
    </div>
  );
}

function PriceRow({ row, onSaved, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(row.item_name);
  const [price, setPrice] = useState(String(row.price_usd));
  const [unit, setUnit] = useState(row.unit);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  function startEdit() {
    setName(row.item_name);
    setPrice(String(row.price_usd));
    setUnit(row.unit);
    setErr('');
    setEditing(true);
  }

  async function save() {
    const item_name = name.trim();
    const price_usd = Number(price);
    if (!item_name) return setErr('Enter an item name.');
    if (!Number.isFinite(price_usd) || price_usd < 0) return setErr('Enter a valid price.');
    setSaving(true);
    setErr('');
    try {
      const d = await apiPatch(`/api/price-references/${row.id}`, {
        item_name,
        price_usd,
        unit,
      });
      onSaved(d.price_reference);
      setEditing(false);
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <li className="py-3">
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-48 rounded-lg border border-gray-300 px-3 py-1.5 text-sm outline-none focus:border-rescue-green focus:ring-1 focus:ring-rescue-green"
          />
          <input
            type="number"
            min="0"
            step="0.01"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="w-24 rounded-lg border border-gray-300 px-3 py-1.5 text-sm outline-none focus:border-rescue-green focus:ring-1 focus:ring-rescue-green"
          />
          <select
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm outline-none focus:border-rescue-green focus:ring-1 focus:ring-rescue-green"
          >
            <option value="per_unit">each</option>
            <option value="per_lb">per lb</option>
          </select>
          <button
            onClick={save}
            disabled={saving}
            className="rounded-lg bg-rescue-green px-3 py-1.5 text-sm font-semibold text-white hover:bg-rescue-green-dark disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button
            onClick={() => setEditing(false)}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
        {err && <p className="mt-1 text-sm text-red-600">{err}</p>}
      </li>
    );
  }

  return (
    <li className="flex items-center justify-between gap-3 py-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-rescue-ink">{row.item_name}</p>
        <p className="text-xs text-gray-500">
          {formatUsd(row.price_usd)} {UNIT_LABEL[row.unit] || row.unit}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button
          onClick={startEdit}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:border-rescue-green hover:text-rescue-green"
        >
          Edit
        </button>
        <button
          onClick={onDelete}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-600 transition hover:border-red-400 hover:text-red-600"
        >
          Delete
        </button>
      </div>
    </li>
  );
}

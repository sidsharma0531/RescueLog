'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import StatusBadge from './StatusBadge';
import { categoryLabel } from '@/lib/categories';
import { formatDate, formatLbs, formatUsd } from '@/lib/format';
import { useTerms } from './OrgMode';

function locationName(p) {
  return p.location?.name || p.location_name_manual || 'Unknown site';
}

// Estimated retail value, falling back to the value embedded in the summary
// jsonb when the ai_total_value column hasn't been populated yet.
function estValue(p) {
  return p.ai_total_value ?? p.ai_category_summary?.total_value_usd ?? null;
}

function topCategory(p) {
  const c = p.ai_category_summary?.categories?.[0];
  return c ? categoryLabel(c.name) : '—';
}

const SORTERS = {
  date: (p) => p.logged_at || '',
  location: (p) => locationName(p).toLowerCase(),
  driver: (p) => (p.driver?.name || '').toLowerCase(),
  ai_weight: (p) => Number(p.ai_total_weight) || 0,
  est_value: (p) => Number(estValue(p)) || 0,
};

export default function PopupsTable({ popups }) {
  const router = useRouter();
  const terms = useTerms();
  const [sortKey, setSortKey] = useState('date');
  const [sortDir, setSortDir] = useState('desc');

  if (!popups || popups.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-gray-400">
        {terms.emptyTableMsg}
      </p>
    );
  }

  const sorted = [...popups].sort((a, b) => {
    const fn = SORTERS[sortKey] || SORTERS.date;
    const av = fn(a);
    const bv = fn(b);
    if (av < bv) return sortDir === 'asc' ? -1 : 1;
    if (av > bv) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  function toggleSort(key) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(
        key === 'date' || key === 'ai_weight' || key === 'est_value'
          ? 'desc'
          : 'asc',
      );
    }
  }

  return (
    <div className="overflow-x-auto thin-scroll">
      <table className="w-full min-w-[880px] text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
            <SortTh label="Date" col="date" {...{ sortKey, sortDir, toggleSort }} />
            <SortTh label="Location" col="location" {...{ sortKey, sortDir, toggleSort }} />
            <SortTh label="Driver" col="driver" {...{ sortKey, sortDir, toggleSort }} />
            <th className="px-3 py-2.5 font-semibold">Photos</th>
            <SortTh label="AI Weight" col="ai_weight" {...{ sortKey, sortDir, toggleSort }} />
            <SortTh label="Est. Value" col="est_value" {...{ sortKey, sortDir, toggleSort }} />
            <th className="px-3 py-2.5 font-semibold">Driver Est.</th>
            <th className="px-3 py-2.5 font-semibold">Top Category</th>
            <th className="px-3 py-2.5 font-semibold">Status</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((p) => (
            <tr
              key={p.id}
              onClick={() => router.push(`/dashboard/popups/${p.id}`)}
              className="cursor-pointer border-b border-gray-100 transition hover:bg-rescue-green-light/60"
            >
              <td className="px-3 py-3 text-gray-600">{formatDate(p.logged_at)}</td>
              <td className="px-3 py-3 font-medium text-rescue-ink">
                {locationName(p)}
              </td>
              <td className="px-3 py-3 text-gray-600">{p.driver?.name || '—'}</td>
              <td className="px-3 py-3 text-gray-600">{p.photo_count ?? 0}</td>
              <td className="px-3 py-3 font-medium text-rescue-ink">
                {p.ai_total_weight != null ? formatLbs(p.ai_total_weight) : '—'}
              </td>
              <td className="px-3 py-3 font-medium text-rescue-green">
                {estValue(p) != null ? formatUsd(estValue(p)) : '—'}
              </td>
              <td className="px-3 py-3 text-gray-500">
                {p.driver_weight_estimate != null
                  ? formatLbs(p.driver_weight_estimate)
                  : '—'}
              </td>
              <td className="px-3 py-3 text-gray-600">{topCategory(p)}</td>
              <td className="px-3 py-3">
                <StatusBadge status={p.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SortTh({ label, col, sortKey, sortDir, toggleSort }) {
  const active = sortKey === col;
  return (
    <th
      onClick={() => toggleSort(col)}
      className="cursor-pointer select-none px-3 py-2.5 font-semibold hover:text-rescue-green"
    >
      {label}
      <span className="text-rescue-green">
        {active ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}
      </span>
    </th>
  );
}

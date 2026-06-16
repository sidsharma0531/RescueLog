'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiGet } from '@/lib/api-client';
import { daysAgoISO, todayISO } from '@/lib/dates';
import { CATEGORIES } from '@/lib/categories';
import FilterBar from '@/components/FilterBar';
import Card from '@/components/Card';
import ExportButton from '@/components/ExportButton';

export default function ExportPage() {
  const [filters, setFilters] = useState({
    from: daysAgoISO(30),
    to: todayISO(),
    location_id: '',
    driver_id: '',
  });
  const [locations, setLocations] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [count, setCount] = useState(null);

  useEffect(() => {
    apiGet('/api/locations')
      .then((d) => setLocations(d.locations || []))
      .catch(() => {});
    apiGet('/api/drivers')
      .then((d) => setDrivers(d.drivers || []))
      .catch(() => {});
  }, []);

  const buildQuery = useCallback((f) => {
    const qs = new URLSearchParams();
    for (const k of ['from', 'to', 'location_id', 'driver_id']) {
      if (f[k]) qs.set(k, f[k]);
    }
    return qs.toString();
  }, []);

  useEffect(() => {
    setCount(null);
    apiGet(`/api/popups?${buildQuery(filters)}`)
      .then((d) => setCount((d.popups || []).length))
      .catch(() => setCount(null));
  }, [filters, buildQuery]);

  const exportHref = `/api/export/csv?${buildQuery(filters)}`;

  const columnChips = [
    'Date',
    'Location',
    'Driver',
    'Total AI Weight',
    'Total Est. Value',
    'Driver Weight',
    ...CATEGORIES.flatMap((c) => [`${c.label} lbs`, `${c.label} %`, `${c.label} $`]),
    'Photo Count',
    'Confidence',
    'Status',
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-rescue-ink">Export</h1>
        <p className="text-sm text-gray-500">
          Download pop-up data as a CSV — built to paste into existing Excel
          grant workbooks.
        </p>
      </div>

      <FilterBar
        value={filters}
        onChange={setFilters}
        locations={locations}
        drivers={drivers}
      />

      <Card>
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-gray-600">
              {count == null
                ? 'Counting matching pop-ups…'
                : `${count} pop-up log${count === 1 ? '' : 's'} match the current filters.`}
            </p>
            <p className="mt-0.5 text-xs text-gray-400">
              One row per pop-up, with per-category pounds, percentages, and
              estimated retail value.
            </p>
          </div>
          <ExportButton href={exportHref} disabled={count === 0} />
        </div>
      </Card>

      <Card title="Columns included">
        <div className="flex flex-wrap gap-2 text-xs">
          {columnChips.map((col, i) => (
            <span
              key={i}
              className="rounded-full bg-gray-100 px-2.5 py-1 text-gray-600"
            >
              {col}
            </span>
          ))}
        </div>
      </Card>
    </div>
  );
}

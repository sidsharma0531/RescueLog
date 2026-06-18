'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiGet } from '@/lib/api-client';
import { daysAgoISO, todayISO } from '@/lib/dates';
import FilterBar from '@/components/FilterBar';
import PopupsTable from '@/components/PopupsTable';
import { LoadingBlock, ErrorBlock } from '@/components/Loading';
import { useTerms } from '@/components/OrgMode';

export default function PopupsListPage() {
  const terms = useTerms();
  const [filters, setFilters] = useState({
    from: daysAgoISO(30),
    to: todayISO(),
    location_id: '',
    driver_id: '',
    status: '',
  });
  const [locations, setLocations] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [popups, setPopups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filter dropdown option lists — loaded once.
  useEffect(() => {
    apiGet('/api/locations')
      .then((d) => setLocations(d.locations || []))
      .catch(() => {});
    apiGet('/api/drivers')
      .then((d) => setDrivers(d.drivers || []))
      .catch(() => {});
  }, []);

  const load = useCallback(async (f) => {
    setLoading(true);
    setError('');
    try {
      const qs = new URLSearchParams();
      for (const key of ['from', 'to', 'location_id', 'driver_id', 'status']) {
        if (f[key]) qs.set(key, f[key]);
      }
      const d = await apiGet(`/api/popups?${qs.toString()}`);
      setPopups(d.popups || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(filters);
  }, [filters, load]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-rescue-ink">{terms.logTitlePlural}</h1>
        <p className="text-sm text-gray-500">
          {loading ? 'Loading…' : `${popups.length} log${popups.length === 1 ? '' : 's'} in range`}
        </p>
      </div>

      <FilterBar
        value={filters}
        onChange={setFilters}
        locations={locations}
        drivers={drivers}
        showStatus
      />

      <div className="rounded-2xl border border-gray-200 bg-white p-2 shadow-sm">
        {loading ? (
          <LoadingBlock />
        ) : error ? (
          <ErrorBlock message={error} onRetry={() => load(filters)} />
        ) : (
          <PopupsTable popups={popups} />
        )}
      </div>
    </div>
  );
}

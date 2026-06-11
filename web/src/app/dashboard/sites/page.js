'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from 'recharts';
import { apiGet } from '@/lib/api-client';
import { CATEGORY_KEYS, normalizeCategoryKey } from '@/lib/categories';
import { formatDate, formatLbs, formatNumber } from '@/lib/format';
import Card from '@/components/Card';
import CategoryChart from '@/components/CategoryChart';
import PopupsTable from '@/components/PopupsTable';
import { LoadingBlock, ErrorBlock } from '@/components/Loading';

// A log's effective site name: its linked location, else the manual name.
function siteNameOf(p) {
  return p.location?.name || p.location_name_manual || 'Unknown site';
}

export default function SitesPage() {
  const [allPopups, setAllPopups] = useState([]);
  const [siteName, setSiteName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Build the site list from the LOGS, not the locations table — so only
  // sites that actually have a pop-up appear, and duplicate location records
  // (or manual names) with the same site name collapse into one entry whose
  // logs are aggregated together.
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const d = await apiGet('/api/popups?limit=500');
      setAllPopups(d.popups || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Distinct site names that have >=1 logged pop-up, alphabetical.
  const sites = useMemo(
    () =>
      [...new Set(allPopups.map(siteNameOf))].sort((a, b) =>
        a.localeCompare(b),
      ),
    [allPopups],
  );

  // Pick a default once sites load, and repair if the selection disappears.
  useEffect(() => {
    if (sites.length && !sites.includes(siteName)) setSiteName(sites[0]);
  }, [sites, siteName]);

  // All logs for the selected site (across any duplicate location records).
  const popups = useMemo(
    () => allPopups.filter((p) => siteNameOf(p) === siteName),
    [allPopups, siteName],
  );

  // Aggregate the category mix across this site's pop-ups.
  const catTotals = Object.fromEntries(CATEGORY_KEYS.map((k) => [k, 0]));
  let siteTotalWeight = 0;
  for (const p of popups) {
    siteTotalWeight += Number(p.ai_total_weight) || 0;
    for (const c of p.ai_category_summary?.categories || []) {
      catTotals[normalizeCategoryKey(c.name)] += Number(c.weight_lbs) || 0;
    }
  }
  const totalCat = CATEGORY_KEYS.reduce((s, k) => s + catTotals[k], 0);
  const categoryData = CATEGORY_KEYS.map((k) => ({
    name: k,
    weight_lbs: Math.round(catTotals[k]),
    percentage: totalCat > 0 ? Math.round((catTotals[k] / totalCat) * 1000) / 10 : 0,
  }));

  const trend = [...popups]
    .filter((p) => p.ai_total_weight != null)
    .sort((a, b) => new Date(a.logged_at) - new Date(b.logged_at))
    .map((p) => ({
      date: formatDate(p.logged_at),
      weight: Math.round(Number(p.ai_total_weight) || 0),
    }));

  const avgWeight = popups.length
    ? Math.round(siteTotalWeight / popups.length)
    : 0;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-rescue-ink">Site Analytics</h1>
        <p className="text-sm text-gray-500">
          Pop-up rescue history for a single location
        </p>
      </div>

      <Card>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
            Site
          </span>
          <select
            value={siteName}
            onChange={(e) => setSiteName(e.target.value)}
            className="max-w-sm rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-rescue-green focus:ring-1 focus:ring-rescue-green"
          >
            {sites.length === 0 && <option value="">No sites with logs yet</option>}
            {sites.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
      </Card>

      {loading ? (
        <LoadingBlock />
      ) : error ? (
        <ErrorBlock message={error} onRetry={load} />
      ) : sites.length === 0 ? (
        <Card>
          <p className="text-sm text-gray-400">
            No sites with logged pop-ups yet.
          </p>
        </Card>
      ) : popups.length === 0 ? (
        <Card>
          <p className="text-sm text-gray-400">
            No pop-up logs at this site yet.
          </p>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <MiniStat label="Pop-ups" value={formatNumber(popups.length)} />
            <MiniStat
              label="Total rescued"
              value={formatLbs(Math.round(siteTotalWeight))}
            />
            <MiniStat label="Avg per pop-up" value={formatLbs(avgWeight)} />
          </div>

          <Card title="Weight rescued per pop-up">
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={trend}
                  margin={{ top: 8, right: 12, bottom: 4, left: -8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#eef0ee" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#9aa0a6" />
                  <YAxis tick={{ fontSize: 11 }} stroke="#9aa0a6" />
                  <Tooltip
                    formatter={(v) => [`${v} lbs`, 'Rescued']}
                    contentStyle={{ fontSize: 12, borderRadius: 8 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="weight"
                    stroke="#2D7D46"
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: '#2D7D46' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card title="Average category mix at this site">
            <CategoryChart data={categoryData} variant="donut" />
          </Card>

          <Card title="All pop-up logs at this site">
            <PopupsTable popups={popups} />
          </Card>
        </>
      )}
    </div>
  );
}

function MiniStat({ label, value }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
        {label}
      </p>
      <p className="mt-1 text-xl font-bold text-rescue-ink">{value}</p>
    </div>
  );
}

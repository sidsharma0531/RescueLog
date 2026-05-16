'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiGet } from '@/lib/api-client';
import { daysAgoISO, todayISO } from '@/lib/dates';
import { categoryLabel } from '@/lib/categories';
import { formatNumber } from '@/lib/format';
import { StatsGrid, StatCard } from '@/components/StatsGrid';
import CategoryChart from '@/components/CategoryChart';
import PopupsTable from '@/components/PopupsTable';
import { LoadingBlock, ErrorBlock } from '@/components/Loading';

export default function OverviewPage() {
  const [stats, setStats] = useState(null);
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const from = daysAgoISO(30);
      const to = todayISO();
      const [s, p] = await Promise.all([
        apiGet(`/api/dashboard/stats?from=${from}&to=${to}`),
        apiGet('/api/popups?limit=10'),
      ]);
      setStats(s);
      setRecent(p.popups || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const categoryData = stats
    ? Object.entries(stats.category_totals || {}).map(([name, v]) => ({
        name,
        weight_lbs: v.weight_lbs,
        percentage: v.percentage,
      }))
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-rescue-ink">Overview</h1>
        <p className="text-sm text-gray-500">Pop-up rescue activity, last 30 days</p>
      </div>

      {loading ? (
        <LoadingBlock label="Loading dashboard…" />
      ) : error ? (
        <ErrorBlock message={error} onRetry={load} />
      ) : (
        <>
          <StatsGrid>
            <StatCard
              label="Pop-ups logged"
              value={formatNumber(stats.total_popups)}
            />
            <StatCard
              label="Est. lbs rescued"
              value={formatNumber(stats.total_ai_weight_lbs)}
              sub="AI estimated"
            />
            <StatCard label="Sites served" value={formatNumber(stats.unique_sites)} />
            <StatCard
              label="Top category"
              accent="orange"
              value={
                stats.top_category
                  ? categoryLabel(stats.top_category.key)
                  : '—'
              }
              sub={
                stats.top_category
                  ? `${stats.top_category.percentage}% of rescued weight`
                  : 'No data yet'
              }
            />
          </StatsGrid>

          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="mb-1 text-base font-semibold text-rescue-ink">
              Category breakdown
            </h2>
            <p className="mb-4 text-sm text-gray-500">
              What kind of food is being rescued — category data that has never
              existed before.
            </p>
            <CategoryChart data={categoryData} variant="donut" />
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold text-rescue-ink">
                Recent pop-up logs
              </h2>
              <a
                href="/dashboard/popups"
                className="text-sm font-medium text-rescue-green hover:underline"
              >
                View all →
              </a>
            </div>
            <PopupsTable popups={recent} />
          </section>
        </>
      )}
    </div>
  );
}

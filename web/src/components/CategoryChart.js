'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { categoryLabel, categoryColor } from '@/lib/categories';
import { formatLbs } from '@/lib/format';

// Renders an aggregated category breakdown. `data` is an array of
// { name, weight_lbs, percentage } (the ai_category_summary.categories shape).
// variant: 'donut' (overview wow chart) | 'bars' (detail breakdown).
export default function CategoryChart({ data, variant = 'donut' }) {
  const rows = (data || [])
    .filter((d) => (d.weight_lbs || 0) > 0)
    .map((d) => ({
      key: d.name,
      label: categoryLabel(d.name),
      color: categoryColor(d.name),
      weight: d.weight_lbs || 0,
      pct: d.percentage || 0,
    }))
    .sort((a, b) => b.weight - a.weight);

  if (rows.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-gray-400">
        No category data yet.
      </p>
    );
  }

  return variant === 'bars' ? <BarList rows={rows} /> : <Donut rows={rows} />;
}

function Donut({ rows }) {
  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row">
      <div className="h-[220px] w-[220px] shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={rows}
              dataKey="weight"
              nameKey="label"
              innerRadius={58}
              outerRadius={92}
              paddingAngle={2}
              stroke="none"
            >
              {rows.map((r) => (
                <Cell key={r.key} fill={r.color} />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="grid w-full grid-cols-1 gap-x-6 gap-y-1.5 sm:grid-cols-2">
        {rows.map((r) => (
          <li key={r.key} className="flex items-center gap-2 text-sm">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-sm"
              style={{ backgroundColor: r.color }}
            />
            <span className="flex-1 text-gray-700">{r.label}</span>
            <span className="font-medium text-rescue-ink">{r.pct}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function BarList({ rows }) {
  const max = Math.max(...rows.map((r) => r.weight), 1);
  return (
    <div className="space-y-3">
      {rows.map((r) => (
        <div key={r.key}>
          <div className="mb-1 flex items-baseline justify-between text-sm">
            <span className="font-medium text-gray-700">{r.label}</span>
            <span className="text-gray-500">
              {formatLbs(r.weight)}{' '}
              <span className="text-gray-400">· {r.pct}%</span>
            </span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.max((r.weight / max) * 100, 2)}%`,
                backgroundColor: r.color,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function ChartTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const r = payload[0].payload;
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs shadow-md">
      <p className="font-semibold text-rescue-ink">{r.label}</p>
      <p className="text-gray-500">
        {formatLbs(r.weight)} · {r.pct}%
      </p>
    </div>
  );
}

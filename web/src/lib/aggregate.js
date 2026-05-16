import { CATEGORIES, CATEGORY_KEYS, normalizeCategoryKey } from './categories';

const round1 = (n) => Math.round(n * 10) / 10;
const round2 = (n) => Math.round(n * 100) / 100;

// Combine the per-photo AI analyses for one popup log into a single
// category summary. Cross-photo dedup is simple category-level summation —
// within-photo dedup is already handled by the vision prompt.
export function aggregatePhotoAnalyses(analyses, driverEstimateLbs) {
  const valid = (analyses || []).filter(
    (a) => a && Array.isArray(a.categories),
  );

  const totals = Object.fromEntries(CATEGORY_KEYS.map((k) => [k, 0]));
  let confidenceSum = 0;
  let confidenceCount = 0;

  for (const a of valid) {
    for (const cat of a.categories) {
      const key = normalizeCategoryKey(cat.name);
      totals[key] += Number(cat.estimated_weight_lbs) || 0;
    }
    if (typeof a.overall_confidence === 'number') {
      confidenceSum += a.overall_confidence;
      confidenceCount += 1;
    }
  }

  const totalWeight = CATEGORY_KEYS.reduce((s, k) => s + totals[k], 0);

  const categories = CATEGORIES.map((c) => ({
    name: c.key,
    weight_lbs: Math.round(totals[c.key]),
    percentage: totalWeight > 0 ? round1((totals[c.key] / totalWeight) * 100) : 0,
  }))
    .filter((c) => c.weight_lbs > 0)
    .sort((a, b) => b.weight_lbs - a.weight_lbs);

  const summary = {
    categories,
    total_weight_lbs: Math.round(totalWeight),
    photo_count: (analyses || []).length,
    overall_confidence:
      confidenceCount > 0 ? round2(confidenceSum / confidenceCount) : null,
  };

  const est = Number(driverEstimateLbs);
  if (driverEstimateLbs != null && !Number.isNaN(est)) {
    summary.driver_estimate_lbs = est;
    summary.estimate_difference_pct =
      est > 0 ? round1(((summary.total_weight_lbs - est) / est) * 100) : null;
  }

  return summary;
}

// Flatten a popup log's category summary into a flat map of
// `${key}_lbs` / `${key}_pct` values — used by the CSV exporter.
export function categorySummaryToFlatRow(summary) {
  const row = {};
  for (const k of CATEGORY_KEYS) {
    row[`${k}_lbs`] = 0;
    row[`${k}_pct`] = 0;
  }
  for (const c of summary?.categories || []) {
    const key = normalizeCategoryKey(c.name);
    row[`${key}_lbs`] = c.weight_lbs || 0;
    row[`${key}_pct`] = c.percentage || 0;
  }
  return row;
}

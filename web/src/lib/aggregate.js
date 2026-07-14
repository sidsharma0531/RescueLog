import { getCategories, getCategoryKeys, normalizeCategoryKey } from './categories';

const round1 = (n) => Math.round(n * 10) / 10;
const round2 = (n) => Math.round(n * 100) / 100;

// Combine the per-photo AI analyses for one popup log into a single
// category summary. Cross-photo dedup is simple category-level summation —
// within-photo dedup is already handled by the vision prompt.
// `profile` selects the category set ('general' for pop-up/cart orgs,
// 'produce' for gleaning orgs) and must match the profile the photos were
// analyzed with, or categories collapse into the catch-all bucket.
export function aggregatePhotoAnalyses(analyses, driverEstimateLbs, profile = 'general') {
  const keys = getCategoryKeys(profile);
  const valid = (analyses || []).filter(
    (a) => a && Array.isArray(a.categories),
  );

  const totals = Object.fromEntries(keys.map((k) => [k, 0]));
  const values = Object.fromEntries(keys.map((k) => [k, 0]));
  let confidenceSum = 0;
  let confidenceCount = 0;

  for (const a of valid) {
    for (const cat of a.categories) {
      const key = normalizeCategoryKey(cat.name, profile);
      totals[key] += Number(cat.estimated_weight_lbs) || 0;
      values[key] += Number(cat.estimated_value_usd) || 0;
    }
    if (typeof a.overall_confidence === 'number') {
      confidenceSum += a.overall_confidence;
      confidenceCount += 1;
    }
  }

  const totalWeight = keys.reduce((s, k) => s + totals[k], 0);
  const totalValue = keys.reduce((s, k) => s + values[k], 0);

  const categories = getCategories(profile)
    .map((c) => ({
      name: c.key,
      weight_lbs: Math.round(totals[c.key]),
      value_usd: Math.round(values[c.key]),
      percentage: totalWeight > 0 ? round1((totals[c.key] / totalWeight) * 100) : 0,
    }))
    .filter((c) => c.weight_lbs > 0 || c.value_usd > 0)
    .sort((a, b) => b.weight_lbs - a.weight_lbs);

  const summary = {
    categories,
    total_weight_lbs: Math.round(totalWeight),
    total_value_usd: Math.round(totalValue),
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
// `${key}_lbs` / `${key}_pct` / `${key}_value` values — used by the CSV
// exporter. Pass the same profile the export's columns are built from.
export function categorySummaryToFlatRow(summary, profile = 'general') {
  const row = {};
  for (const k of getCategoryKeys(profile)) {
    row[`${k}_lbs`] = 0;
    row[`${k}_pct`] = 0;
    row[`${k}_value`] = 0;
  }
  for (const c of summary?.categories || []) {
    const key = normalizeCategoryKey(c.name, profile);
    row[`${key}_lbs`] = c.weight_lbs || 0;
    row[`${key}_pct`] = c.percentage || 0;
    row[`${key}_value`] = c.value_usd || 0;
  }
  return row;
}

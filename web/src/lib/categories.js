// Single source of truth for food categories used across the AI pipeline,
// dashboard charts, and CSV export. The `key` values must match exactly the
// category strings the vision prompt is instructed to return.
//
// Categories come in PROFILES, selected by the org's capture mode:
//   - 'general': the full food-category set (pop-up + cart orgs)
//   - 'produce': produce-specific set (gleaning orgs, e.g. Glean Kentucky)

export const CATEGORIES = [
  { key: 'produce',      label: 'Produce',        color: '#4CAF50' },
  { key: 'meat_poultry', label: 'Meat & Poultry', color: '#C5453B' },
  { key: 'dairy',        label: 'Dairy',          color: '#5B9BD5' },
  { key: 'eggs',         label: 'Eggs',           color: '#E8B23A' },
  { key: 'bakery_bread', label: 'Bakery & Bread', color: '#C98A4B' },
  { key: 'frozen',       label: 'Frozen',         color: '#7BC4D4' },
  { key: 'beverages',    label: 'Beverages',      color: '#8E6FB0' },
  { key: 'grab_n_go',    label: 'Grab-n-Go',      color: '#E8832A' },
  { key: 'shelf_stable', label: 'Shelf-Stable',   color: '#9C8B6E' },
  { key: 'other',        label: 'Other',          color: '#9AA0A6' },
];

export const PRODUCE_CATEGORIES = [
  { key: 'fruit',            label: 'Fruit',             color: '#E8832A' },
  { key: 'leafy_greens',     label: 'Leafy Greens',      color: '#2E8B57' },
  { key: 'root_vegetables',  label: 'Root Vegetables',   color: '#A0522D' },
  { key: 'squash_melons',    label: 'Squash & Melons',   color: '#E8B23A' },
  { key: 'tomatoes_peppers', label: 'Tomatoes & Peppers', color: '#C5453B' },
  { key: 'mixed_vegetables', label: 'Mixed Vegetables',  color: '#4CAF50' },
  { key: 'herbs',            label: 'Herbs',             color: '#00897B' },
  { key: 'other_produce',    label: 'Other Produce',     color: '#9C8B6E' },
  { key: 'non_produce',      label: 'Non-Produce/Other', color: '#9AA0A6' },
];

export const CATEGORY_PROFILES = {
  general: CATEGORIES,
  produce: PRODUCE_CATEGORIES,
  // Cross-org aggregation (super admin "All Orgs" view): every category from
  // every profile, so pop-up/cart logs and gleaning logs sum side by side
  // without colliding. Keys are globally unique across profiles.
  union: [...CATEGORIES, ...PRODUCE_CATEGORIES],
};

// Which category profile a capture mode uses. 'all' is the super admin's
// virtual all-orgs mode.
export function profileForMode(captureMode) {
  if (captureMode === 'gleaning') return 'produce';
  if (captureMode === 'all') return 'union';
  return 'general';
}

export function getCategories(profile = 'general') {
  return CATEGORY_PROFILES[profile] || CATEGORIES;
}

export function getCategoryKeys(profile = 'general') {
  return getCategories(profile).map((c) => c.key);
}

// Existing exports, unchanged for all current call sites (general profile).
export const CATEGORY_KEYS = CATEGORIES.map((c) => c.key);

// Labels/colors resolve across ALL profiles so display components (charts,
// tables, detail pages) can render any log's categories without knowing which
// profile produced them. Keys are globally unique across profiles.
const UNION_MAP = Object.fromEntries(
  Object.values(CATEGORY_PROFILES)
    .flat()
    .map((c) => [c.key, c]),
);

export const CATEGORY_MAP = UNION_MAP;

export function categoryLabel(key) {
  return UNION_MAP[key]?.label || key;
}

export function categoryColor(key) {
  return UNION_MAP[key]?.color || '#9AA0A6';
}

// Normalize a category name returned by the model to a known key within the
// given profile. Tolerates spaces, hyphens, and casing ("Leafy Greens" ->
// "leafy_greens"). Unknown names fall into the profile's catch-all bucket.
export function normalizeCategoryKey(name, profile = 'general') {
  const keys = getCategoryKeys(profile);
  const fallback = profile === 'produce' ? 'non_produce' : 'other';
  // ('union' falls back to general's catch-all 'other', which it contains.)
  if (!name) return fallback;
  const k = String(name).toLowerCase().trim().replace(/[\s/&-]+/g, '_');
  return keys.includes(k) ? k : fallback;
}

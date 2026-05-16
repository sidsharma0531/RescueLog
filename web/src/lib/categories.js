// Single source of truth for food categories used across the AI pipeline,
// dashboard charts, and CSV export. The `key` values must match exactly the
// category strings the vision prompt is instructed to return.

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

export const CATEGORY_KEYS = CATEGORIES.map((c) => c.key);

export const CATEGORY_MAP = Object.fromEntries(CATEGORIES.map((c) => [c.key, c]));

export function categoryLabel(key) {
  return CATEGORY_MAP[key]?.label || key;
}

export function categoryColor(key) {
  return CATEGORY_MAP[key]?.color || '#9AA0A6';
}

// Normalize a category name returned by the model to a known key.
// Tolerates spaces, hyphens, and casing ("Meat Poultry" -> "meat_poultry").
export function normalizeCategoryKey(name) {
  if (!name) return 'other';
  const k = String(name).toLowerCase().trim().replace(/[\s/-]+/g, '_');
  return CATEGORY_KEYS.includes(k) ? k : 'other';
}

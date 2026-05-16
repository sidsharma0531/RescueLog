// Normalize a bare YYYY-MM-DD filter value to the start/end of that day so
// `lte` date-range filters include the whole final day.

export function startOfDay(dateStr) {
  if (!dateStr) return null;
  return dateStr.includes('T') ? dateStr : `${dateStr}T00:00:00.000`;
}

export function endOfDay(dateStr) {
  if (!dateStr) return null;
  return dateStr.includes('T') ? dateStr : `${dateStr}T23:59:59.999`;
}

// YYYY-MM-DD for a Date (local time).
export function toDateKey(date) {
  const d = date instanceof Date ? date : new Date(date);
  return d.toISOString().slice(0, 10);
}

// YYYY-MM-DD for today.
export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

// YYYY-MM-DD for N days ago.
export function daysAgoISO(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

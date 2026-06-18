// Display formatting helpers shared across the dashboard.

export function formatDate(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatDateTime(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatNumber(n) {
  if (n === null || n === undefined || n === '') return '—';
  return Number(n).toLocaleString('en-US');
}

export function formatLbs(n) {
  if (n === null || n === undefined || n === '') return '—';
  return `${Number(n).toLocaleString('en-US')} lbs`;
}

// Estimated retail value in whole US dollars (e.g. 1234 -> "$1,234").
export function formatUsd(n) {
  if (n === null || n === undefined || n === '') return '—';
  return Number(n).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  });
}

export function formatPercent(n) {
  if (n === null || n === undefined || n === '') return '—';
  return `${Number(n).toFixed(1)}%`;
}

// Confidence (0-1) as a whole-number percent.
export function formatConfidence(n) {
  if (n === null || n === undefined || n === '') return '—';
  return `${Math.round(Number(n) * 100)}%`;
}

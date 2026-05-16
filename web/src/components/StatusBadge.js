const STYLES = {
  complete: 'bg-rescue-green-light text-rescue-green-dark',
  processing: 'bg-amber-100 text-amber-800',
  partial: 'bg-orange-100 text-orange-800',
  failed: 'bg-red-100 text-red-700',
};

const LABELS = {
  complete: 'Complete',
  processing: 'Processing',
  partial: 'Partial',
  failed: 'Failed',
};

export default function StatusBadge({ status }) {
  const s = status || 'processing';
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
        STYLES[s] || STYLES.processing
      }`}
    >
      {LABELS[s] || s}
    </span>
  );
}

// Triggers a CSV download. The /api/export/csv route sends a
// Content-Disposition header, so a plain link downloads the file.
export default function ExportButton({ href, children = 'Download CSV', disabled }) {
  if (disabled) {
    return (
      <span className="inline-flex cursor-not-allowed items-center gap-2 rounded-lg bg-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-400">
        {children}
      </span>
    );
  }
  return (
    <a
      href={href}
      className="inline-flex items-center gap-2 rounded-lg bg-rescue-green px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-rescue-green-dark"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {children}
    </a>
  );
}

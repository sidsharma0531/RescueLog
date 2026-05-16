// Standard white panel used across the dashboard.
export default function Card({ title, action, children, className = '' }) {
  return (
    <section
      className={`rounded-2xl border border-gray-200 bg-white p-5 shadow-sm ${className}`}
    >
      {(title || action) && (
        <div className="mb-3 flex items-center justify-between gap-3">
          {title && (
            <h2 className="text-base font-semibold text-rescue-ink">{title}</h2>
          )}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

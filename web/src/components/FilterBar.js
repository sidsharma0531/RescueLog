'use client';

const CONTROL =
  'rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-rescue-green focus:ring-1 focus:ring-rescue-green';

function Field({ label, children }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
        {label}
      </span>
      {children}
    </label>
  );
}

export default function FilterBar({
  value,
  onChange,
  locations = [],
  drivers = [],
  showStatus = false,
}) {
  const set = (patch) => onChange({ ...value, ...patch });

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <Field label="From">
        <input
          type="date"
          value={value.from || ''}
          onChange={(e) => set({ from: e.target.value })}
          className={CONTROL}
        />
      </Field>
      <Field label="To">
        <input
          type="date"
          value={value.to || ''}
          onChange={(e) => set({ to: e.target.value })}
          className={CONTROL}
        />
      </Field>
      <Field label="Location">
        <select
          value={value.location_id || ''}
          onChange={(e) => set({ location_id: e.target.value })}
          className={CONTROL}
        >
          <option value="">All sites</option>
          {locations.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Driver">
        <select
          value={value.driver_id || ''}
          onChange={(e) => set({ driver_id: e.target.value })}
          className={CONTROL}
        >
          <option value="">All drivers</option>
          {drivers.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </Field>
      {showStatus && (
        <Field label="Status">
          <select
            value={value.status || ''}
            onChange={(e) => set({ status: e.target.value })}
            className={CONTROL}
          >
            <option value="">Any status</option>
            <option value="complete">Complete</option>
            <option value="partial">Partial</option>
            <option value="processing">Processing</option>
            <option value="failed">Failed</option>
          </select>
        </Field>
      )}
    </div>
  );
}

// Browser-side fetch helpers for the dashboard. Same-origin calls to the
// Next.js API routes. No secrets here — safe to import into client components.

async function parse(res) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}

export async function apiGet(path) {
  return parse(await fetch(path, { cache: 'no-store' }));
}

export async function apiPost(path, body) {
  return parse(
    await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}),
    }),
  );
}

export async function apiDelete(path) {
  return parse(await fetch(path, { method: 'DELETE' }));
}

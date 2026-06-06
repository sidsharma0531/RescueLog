import { createClient } from '@supabase/supabase-js';

// SERVER-ONLY. This client uses the service-role key, which bypasses Row
// Level Security. Never import this file into a client component.

// Sanitize the URL: a stray trailing space/newline (easy to paste into a
// Vercel env var) gets baked into signed-URL hosts as "...supabase.co%20",
// which fails DNS with ERR_NAME_NOT_RESOLVED in the browser. Trim whitespace
// and any trailing slashes.
const rawSupabaseUrl = process.env.SUPABASE_URL || '';
const supabaseUrl = rawSupabaseUrl.trim().replace(/\/+$/, '');
const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

function isValidHttpUrl(value) {
  try {
    const u = new URL(value);
    return (
      (u.protocol === 'https:' || u.protocol === 'http:') &&
      !!u.hostname &&
      u.hostname !== 'localhost'
    );
  } catch {
    return false;
  }
}

if (!isValidHttpUrl(supabaseUrl) || !serviceRoleKey) {
  console.warn(
    '[supabase] SUPABASE_URL is missing/malformed or SUPABASE_SERVICE_ROLE_KEY ' +
      `is unset. SUPABASE_URL raw=${JSON.stringify(rawSupabaseUrl)} ` +
      `sanitized=${JSON.stringify(supabaseUrl)}. Check the Vercel env vars.`,
  );
}

export const supabaseAdmin = createClient(
  supabaseUrl || 'http://localhost',
  serviceRoleKey || 'missing-key',
  { auth: { persistSession: false, autoRefreshToken: false } },
);

export const PHOTO_BUCKET = 'popup-photos';

// Upload a photo buffer to Storage and return its public URL + path.
export async function uploadPhoto(buffer, path, contentType = 'image/jpeg') {
  const { error } = await supabaseAdmin.storage
    .from(PHOTO_BUCKET)
    .upload(path, buffer, { contentType, upsert: true });
  if (error) throw new Error(`Storage upload failed: ${error.message}`);

  const { data } = supabaseAdmin.storage.from(PHOTO_BUCKET).getPublicUrl(path);
  return { publicUrl: data.publicUrl, path };
}

// Returns photo rows with photo_url replaced by a freshly signed URL derived
// from each row's storage_path. Signed URLs are generated with the
// service-role key, so dashboard images load whether the bucket is public or
// private and regardless of the anon read policy — robust against storage
// access config drifting. Falls back to the stored photo_url when a row has
// no storage_path or signing fails.
export async function withSignedPhotoUrls(photos, expiresIn = 86400) {
  const list = photos || [];
  const paths = list.map((p) => p.storage_path).filter(Boolean);
  if (paths.length === 0) return list;

  try {
    const { data, error } = await supabaseAdmin.storage
      .from(PHOTO_BUCKET)
      .createSignedUrls(paths, expiresIn);
    if (error || !data) {
      console.warn('[photos] createSignedUrls failed:', error?.message || 'no data');
      return list;
    }

    // Diagnostics: surface what the signing actually produced.
    console.log(
      `[photos] signing ${paths.length} url(s) with base ${JSON.stringify(supabaseUrl)}; sample=`,
      data[0]?.signedUrl,
    );

    const signedByPath = new Map();
    for (const item of data) {
      // Only use a signed URL if it's a well-formed absolute URL with a real
      // host — otherwise fall back to the stored public URL below.
      if (item && item.path && item.signedUrl && isValidHttpUrl(item.signedUrl)) {
        signedByPath.set(item.path, item.signedUrl);
      } else if (item && item.signedUrl) {
        console.warn('[photos] discarding malformed signed URL:', item.signedUrl);
      }
    }

    return list.map((p) => {
      const signed = p.storage_path ? signedByPath.get(p.storage_path) : null;
      return signed ? { ...p, photo_url: signed } : p;
    });
  } catch (e) {
    console.warn('[photos] signing threw:', e?.message || e);
    return list; // never let signing break the response
  }
}

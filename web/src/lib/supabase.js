import { createClient } from '@supabase/supabase-js';

// SERVER-ONLY. This client uses the service-role key, which bypasses Row
// Level Security. Never import this file into a client component.

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.warn(
    '[supabase] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set — ' +
      'database calls will fail. Check web/.env.local.',
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
    if (error || !data) return list;

    const signedByPath = new Map();
    for (const item of data) {
      if (item && item.path && item.signedUrl) {
        signedByPath.set(item.path, item.signedUrl);
      }
    }

    return list.map((p) => {
      const signed = p.storage_path ? signedByPath.get(p.storage_path) : null;
      return signed ? { ...p, photo_url: signed } : p;
    });
  } catch {
    return list; // never let signing break the response
  }
}

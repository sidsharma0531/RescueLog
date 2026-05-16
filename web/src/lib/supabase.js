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

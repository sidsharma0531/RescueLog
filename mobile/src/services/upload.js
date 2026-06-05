import { readAsStringAsync, EncodingType } from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { supabase, PHOTO_BUCKET } from './supabase';

// Reads one local photo, uploads it to Supabase Storage, and returns its
// public URL + storage path. Photos are sent straight to Storage from the
// phone so the (large) image bytes never pass through the Vercel API,
// which caps request bodies at ~4.5MB.
async function uploadOne(uri, popupId, index) {
  const base64 = await readAsStringAsync(uri, {
    encoding: EncodingType.Base64,
  });
  const bytes = decode(base64); // ArrayBuffer — accepted by supabase-js
  const path = `${popupId}/${Date.now()}-${index}.jpg`;

  const { error } = await supabase.storage
    .from(PHOTO_BUCKET)
    .upload(path, bytes, { contentType: 'image/jpeg', upsert: true });
  if (error) {
    throw new Error(error.message || 'Photo upload failed.');
  }

  const { data } = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path);
  return { url: data.publicUrl, storage_path: path };
}

// Uploads photos one at a time so the driver sees per-photo progress.
// onProgress(completedCount, total) fires before each upload (so the UI can
// show "Uploading photo N of M") and once more when everything is done.
// Returns [{ url, storage_path }] in the original order.
export async function uploadPhotosToStorage(uris, popupId, onProgress) {
  const out = [];
  for (let i = 0; i < uris.length; i += 1) {
    if (onProgress) onProgress(i, uris.length);
    out.push(await uploadOne(uris[i], popupId, i));
  }
  if (onProgress) onProgress(uris.length, uris.length);
  return out;
}

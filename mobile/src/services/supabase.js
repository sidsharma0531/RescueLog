import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../constants/config';

// Client-side Supabase client (anon key). Used only for uploading photos
// directly to Storage from the phone. No auth session is persisted.
export const PHOTO_BUCKET = 'popup-photos';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

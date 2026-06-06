// ── RescueLog mobile configuration ──────────────────────────────
// Point this at your backend.
//   • Production:  your Vercel URL, e.g. https://rescuelog.vercel.app
//   • Local dev:   your computer's LAN IP, e.g. http://192.168.1.20:3000
//                  ("localhost" will NOT work from a physical phone)
export const API_BASE_URL = 'https://rescuelog-mu.vercel.app';

// Supabase — Settings > API in the Supabase dashboard. The mobile app
// uploads photos straight to Supabase Storage (bypassing Vercel's ~4.5MB
// request-body limit), so it needs the project URL and the ANON (public)
// key. The anon key is designed to ship in client apps — NEVER put the
// service-role key here.
export const SUPABASE_URL = 'https://lsnrhofvanrhhnntblmc.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxzbnJob2Z2YW5yaGhubnRibG1jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg5NTA2NzUsImV4cCI6MjA5NDUyNjY3NX0.drKVPiyQO6kE6CXQ8VviitBgpl1fmfxfKOjA0xoRBEY';

// Two pop-up logs within this many meters count as the same site.
export const LOCATION_MATCH_RADIUS_METERS = 200;

// Photos are downscaled to this longest-edge pixel size before upload,
// which keeps uploads fast and well under serverless body limits.
export const MAX_PHOTO_DIMENSION = 1920;
export const PHOTO_QUALITY = 0.6; // JPEG compression, 0–1

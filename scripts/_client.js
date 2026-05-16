// Shared Supabase client for the seed scripts.
// Reads credentials from web/.env.local (same file the Next.js app uses).
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

require('dotenv').config({
  path: path.join(__dirname, '..', 'web', '.env.local'),
});

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error(
    '\n  Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.\n' +
      '  Fill in web/.env.local first (see .env.example), then re-run.\n',
  );
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

module.exports = { supabase };

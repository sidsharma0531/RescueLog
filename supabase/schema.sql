-- ============================================================
-- RescueLog — Supabase schema
-- Run once in the Supabase SQL editor (SQL Editor > New query > Run).
-- Safe to re-run: uses IF NOT EXISTS / ON CONFLICT.
-- ============================================================

-- ---- Extensions ------------------------------------------------
create extension if not exists "pgcrypto";  -- provides gen_random_uuid()

-- ---- Tables ----------------------------------------------------

-- ORGANIZATIONS: food-rescue organizations using RescueLog. New
-- organizations register through the mobile app with status = 'pending'
-- and are flipped to 'approved' by an admin via SQL:
--   update organizations set status = 'approved' where name = '...';
create table if not exists organizations (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  status        text default 'pending',   -- pending | approved
  contact_name  text,
  email         text,
  phone         text,
  created_at    timestamptz default now()
);

-- DRIVERS: per-organization driver accounts; login is name + 4-digit PIN.
create table if not exists drivers (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid references organizations(id),
  name             text not null,
  pin              text not null,
  is_active        boolean default true,
  created_at       timestamptz default now()
);

-- ADMIN USERS: dashboard login (Max, Lisa, Barbara).
create table if not exists admin_users (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  email          text unique not null,
  password_hash  text not null,
  role           text default 'admin',
  created_at     timestamptz default now()
);

-- LOCATIONS: pop-up sites, auto-built from GPS and named once by a driver.
create table if not exists locations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  address     text,
  latitude    double precision not null,
  longitude   double precision not null,
  created_at  timestamptz default now()
);

-- POPUP LOGS: one row per pop-up event logged by a driver.
create table if not exists popup_logs (
  id                     uuid primary key default gen_random_uuid(),
  organization_id        uuid references organizations(id),
  driver_id              uuid not null references drivers(id),
  location_id            uuid references locations(id),
  location_name_manual   text,
  latitude               double precision,
  longitude              double precision,
  driver_weight_estimate numeric,
  manual_estimate_lbs    numeric,   -- admin-entered reference weight (dashboard)
  ai_total_weight        numeric,
  ai_category_summary    jsonb,
  status                 text default 'processing',  -- processing | complete | partial | failed
  photo_count            integer default 0,
  notes                  text,
  logged_at              timestamptz default now(),
  processed_at           timestamptz,
  created_at             timestamptz default now()
);

-- POPUP PHOTOS: one row per photo within a popup log.
create table if not exists popup_photos (
  id                 uuid primary key default gen_random_uuid(),
  popup_log_id       uuid not null references popup_logs(id) on delete cascade,
  photo_url          text not null,
  storage_path       text,
  photo_order        integer default 0,
  ai_analysis        jsonb,
  ai_confidence      numeric,
  processing_status  text default 'pending',  -- pending | processing | complete | failed
  processing_error   text,
  created_at         timestamptz default now()
);

-- ---- Indexes ---------------------------------------------------
create index if not exists idx_organizations_status       on organizations(status);
create index if not exists idx_drivers_organization_id    on drivers(organization_id);
create index if not exists idx_popup_logs_logged_at       on popup_logs(logged_at desc);
create index if not exists idx_popup_logs_driver_id       on popup_logs(driver_id);
create index if not exists idx_popup_logs_location_id     on popup_logs(location_id);
create index if not exists idx_popup_logs_status          on popup_logs(status);
create index if not exists idx_popup_logs_organization_id on popup_logs(organization_id);
create index if not exists idx_popup_photos_log_id        on popup_photos(popup_log_id);

-- ---- Row Level Security ----------------------------------------
-- All app traffic goes through the Next.js API using the service-role
-- key, which bypasses RLS. Enabling RLS with no policies locks the
-- tables to the anon/public key, so a leaked anon key exposes nothing.
alter table organizations enable row level security;
alter table drivers       enable row level security;
alter table admin_users   enable row level security;
alter table locations     enable row level security;
alter table popup_logs    enable row level security;
alter table popup_photos  enable row level security;

-- ---- Storage bucket --------------------------------------------
-- Public-read bucket so the dashboard can render photos by URL.
-- Uploads happen server-side with the service-role key.
insert into storage.buckets (id, name, public)
values ('popup-photos', 'popup-photos', true)
on conflict (id) do update set public = true;

drop policy if exists "popup-photos public read" on storage.objects;
create policy "popup-photos public read"
  on storage.objects for select
  using (bucket_id = 'popup-photos');

-- The mobile app uploads photos straight to Storage with the anon key to
-- bypass Vercel's ~4.5MB request-body limit, so anon needs INSERT on this
-- one bucket. (Tradeoff: anyone with the public anon key can write to the
-- popup-photos bucket. Acceptable for this internal tool; harden later
-- with signed upload URLs if needed.)
drop policy if exists "popup-photos public upload" on storage.objects;
create policy "popup-photos public upload"
  on storage.objects for insert
  to anon, authenticated
  with check (bucket_id = 'popup-photos');

-- ---- Seed: launch partner --------------------------------------
-- Pin Second Servings Houston to a stable UUID so existing drivers can
-- be migrated and the app has a known starter organization.
insert into organizations (id, name, status)
values ('00000000-0000-0000-0000-000000000001',
        'Second Servings Houston',
        'approved')
on conflict (id) do nothing;

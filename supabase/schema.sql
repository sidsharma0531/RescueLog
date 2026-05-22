-- ============================================================
-- RescueLog — Supabase schema
-- Run once in the Supabase SQL editor (SQL Editor > New query > Run).
-- Safe to re-run: uses IF NOT EXISTS / ON CONFLICT.
-- ============================================================

-- ---- Extensions ------------------------------------------------
create extension if not exists "pgcrypto";  -- provides gen_random_uuid()

-- ---- Tables ----------------------------------------------------

-- DRIVERS: preset accounts for drivers; login via name + 4-digit PIN
create table if not exists drivers (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  pin         text not null,
  is_active   boolean default true,
  created_at  timestamptz default now()
);

-- ADMIN USERS: dashboard login for Max, Lisa, Barbara
create table if not exists admin_users (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  email          text unique not null,
  password_hash  text not null,
  role           text default 'admin',
  created_at     timestamptz default now()
);

-- LOCATIONS: pop-up sites, auto-built from GPS and named once by a driver
create table if not exists locations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  address     text,
  latitude    double precision not null,
  longitude   double precision not null,
  created_at  timestamptz default now()
);

-- POPUP LOGS: one row per pop-up event logged by a driver
create table if not exists popup_logs (
  id                     uuid primary key default gen_random_uuid(),
  driver_id              uuid not null references drivers(id),
  location_id            uuid references locations(id),
  location_name_manual   text,
  latitude               double precision,
  longitude              double precision,
  driver_weight_estimate numeric,
  ai_total_weight        numeric,
  ai_category_summary    jsonb,
  status                 text default 'processing',  -- processing | complete | partial | failed
  photo_count            integer default 0,
  notes                  text,
  logged_at              timestamptz default now(),
  processed_at           timestamptz,
  created_at             timestamptz default now()
);

-- POPUP PHOTOS: one row per photo within a popup log
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
create index if not exists idx_popup_logs_logged_at   on popup_logs(logged_at desc);
create index if not exists idx_popup_logs_driver_id   on popup_logs(driver_id);
create index if not exists idx_popup_logs_location_id on popup_logs(location_id);
create index if not exists idx_popup_logs_status      on popup_logs(status);
create index if not exists idx_popup_photos_log_id    on popup_photos(popup_log_id);

-- ---- Row Level Security ----------------------------------------
-- All app traffic goes through the Next.js API using the service-role
-- key, which bypasses RLS. Enabling RLS with no policies locks the
-- tables to the anon/public key, so a leaked anon key exposes nothing.
alter table drivers      enable row level security;
alter table admin_users  enable row level security;
alter table locations    enable row level security;
alter table popup_logs   enable row level security;
alter table popup_photos enable row level security;

-- ---- Storage bucket --------------------------------------------
-- Public-read bucket so the dashboard can render photos by URL.
-- Uploads happen server-side with the service-role key.
insert into storage.buckets (id, name, public)
values ('popup-photos', 'popup-photos', true)
on conflict (id) do update set public = true;

-- Allow anonymous read of objects in the popup-photos bucket.
drop policy if exists "popup-photos public read" on storage.objects;
create policy "popup-photos public read"
  on storage.objects for select
  using (bucket_id = 'popup-photos');

-- ---- Org signups -----------------------------------------------
-- Inbound "Get started" requests submitted from the /onboard web page.
create table if not exists org_signups (
  id            uuid primary key default gen_random_uuid(),
  org_name      text not null,
  contact_name  text,
  email         text,
  phone         text,
  created_at    timestamptz default now()
);

alter table org_signups enable row level security;

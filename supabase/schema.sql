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
  capture_mode  text default 'popup',     -- popup | cart (drives the mobile flow)
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

-- ADMIN USERS: dashboard login. Each admin is scoped to one organization, so
-- the dashboard only shows that org's logs/data. is_super_admin is an EXPLICIT
-- master flag (never inferred from a missing organization_id): super admins
-- see an all-orgs aggregate and can drill into any single org.
create table if not exists admin_users (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid references organizations(id),
  name             text not null,
  email            text unique not null,
  password_hash    text not null,
  role             text default 'admin',
  is_super_admin   boolean default false,
  created_at       timestamptz default now()
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
  mode                   text default 'popup',  -- popup | cart
  scale_weight_lbs       numeric,   -- cart mode: ground-truth weight from the scale
  household_id           text,      -- cart mode: recipient/household identifier
  ai_total_weight        numeric,
  ai_total_value         numeric,   -- estimated retail value (USD) of the rescue
  ai_category_summary    jsonb,
  status                 text default 'processing',  -- processing | complete | partial | failed
  photo_count            integer default 0,
  notes                  text,
  logged_at              timestamptz default now(),
  processed_at           timestamptz,
  created_at             timestamptz default now()
);

-- PRICE REFERENCES: per-organization pinned retail prices for recurring items.
-- The vision AI estimates a retail value for everything automatically; these
-- let an org override that for items they receive repeatedly (e.g.
-- "Antone's po-boy = $9 each"). A matching item's AI value is replaced with
-- quantity * price_usd (per_unit) or weight_lbs * price_usd (per_lb).
create table if not exists price_references (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid references organizations(id),
  item_name        text not null,
  price_usd        numeric not null,
  unit             text not null default 'per_unit',  -- per_unit | per_lb
  created_at       timestamptz default now()
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
create index if not exists idx_admin_users_org            on admin_users(organization_id);
create index if not exists idx_price_references_org       on price_references(organization_id);

-- ---- Migrations (safe on existing databases) -------------------
-- Cart Mode (added after the first release). capture_mode drives which capture
-- flow the mobile app shows; mode/scale_weight_lbs record per-cart logs whose
-- total weight comes from a scale rather than an AI estimate.
alter table organizations add column if not exists capture_mode text default 'popup';
alter table popup_logs    add column if not exists mode text default 'popup';
alter table popup_logs    add column if not exists scale_weight_lbs numeric;
alter table popup_logs    add column if not exists household_id text;
-- Per-org admin scoping (added after Cart Mode): each admin sees only their org.
alter table admin_users   add column if not exists organization_id uuid references organizations(id);
-- Explicit super-admin (master) flag.
alter table admin_users   add column if not exists is_super_admin boolean default false;
-- Estimated retail value (value feature).
alter table popup_logs    add column if not exists ai_total_value numeric;
-- Gleaning trips (Glean Kentucky): who donated the produce and which agency
-- received it. Optional, dashboard-editable.
alter table popup_logs    add column if not exists donor_source text;
alter table popup_logs    add column if not exists recipient_agency text;

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
alter table price_references enable row level security;

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

-- ---- Seed: Cart Mode beta partner ------------------------------
-- Second Mile uses Cart Mode (weigh each cart on a scale, AI categorizes the
-- contents). Pinned to a stable UUID; capture_mode flips its mobile flow to
-- "Cart Log".
insert into organizations (id, name, status, capture_mode)
values ('00000000-0000-0000-0000-000000000002',
        'Second Mile',
        'approved',
        'cart')
on conflict (id) do update set status = 'approved', capture_mode = 'cart';

-- Demo driver for Second Mile (login: "Volunteer", PIN 1234).
insert into drivers (organization_id, name, pin)
select '00000000-0000-0000-0000-000000000002', 'Volunteer', '1234'
where not exists (
  select 1 from drivers
  where organization_id = '00000000-0000-0000-0000-000000000002'
    and name = 'Volunteer'
);

-- ---- Seed: gleaning partner ------------------------------------
-- Glean Kentucky uses Gleaning mode (trip-level produce recovery; the AI
-- estimates weight from photos with produce-specific categories).
insert into organizations (id, name, status, capture_mode)
values ('00000000-0000-0000-0000-000000000003',
        'Glean Kentucky',
        'approved',
        'gleaning')
on conflict (id) do update set status = 'approved', capture_mode = 'gleaning';

-- Demo driver for Glean Kentucky (login: "Volunteer", PIN 1234).
insert into drivers (organization_id, name, pin)
select '00000000-0000-0000-0000-000000000003', 'Volunteer', '1234'
where not exists (
  select 1 from drivers
  where organization_id = '00000000-0000-0000-0000-000000000003'
    and name = 'Volunteer'
);

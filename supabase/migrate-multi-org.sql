-- ============================================================
-- RescueLog migration — run ONCE in the Supabase SQL editor.
-- Brings an existing database up to date with Cart Mode + per-org admin
-- scoping. Idempotent and safe to re-run. (Supersedes the older
-- cart-mode-migration.sql — this includes everything in it.)
-- ============================================================

-- 1. Columns ---------------------------------------------------
alter table organizations add column if not exists capture_mode text default 'popup';
alter table popup_logs    add column if not exists mode text default 'popup';
alter table popup_logs    add column if not exists scale_weight_lbs numeric;
alter table popup_logs    add column if not exists household_id text;
alter table popup_logs    add column if not exists ai_total_value numeric;  -- est. retail value
alter table admin_users   add column if not exists organization_id uuid references organizations(id);

-- Value feature: per-org pinned item prices that override the AI's estimate.
create table if not exists price_references (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid references organizations(id),
  item_name        text not null,
  price_usd        numeric not null,
  unit             text not null default 'per_unit',  -- per_unit | per_lb
  created_at       timestamptz default now()
);
create index if not exists idx_price_references_org on price_references(organization_id);
alter table price_references enable row level security;

-- 2. Second Mile org (Cart Mode) + demo driver -----------------
insert into organizations (id, name, status, capture_mode)
values ('00000000-0000-0000-0000-000000000002', 'Second Mile', 'approved', 'cart')
on conflict (id) do update set status = 'approved', capture_mode = 'cart';

update organizations set capture_mode = 'popup'
where id = '00000000-0000-0000-0000-000000000001' and capture_mode is distinct from 'popup';

insert into drivers (organization_id, name, pin)
select '00000000-0000-0000-0000-000000000002', 'Volunteer', '1234'
where not exists (
  select 1 from drivers
  where organization_id = '00000000-0000-0000-0000-000000000002' and name = 'Volunteer'
);

-- 3. Per-org admin scoping -------------------------------------
-- Existing Second Servings admins -> Second Servings.
update admin_users set organization_id = '00000000-0000-0000-0000-000000000001'
where email in (
  'mcurry@secondservingshouston.org',
  'lisa@secondservings.org',
  'barbara@secondservings.org'
);

-- Second Mile admin: Julie (login julie@secondmile.org / rescue123).
-- password_hash is a bcrypt of 'rescue123' — change it before real use.
insert into admin_users (name, email, password_hash, role, organization_id)
values ('Julie', 'julie@secondmile.org',
        '$2a$10$/3Ps.KOLU8ZjgIcBE8D5guOp0kCGOvyPAGM7BNyb6XUTuwxq9ALRa',
        'admin', '00000000-0000-0000-0000-000000000002')
on conflict (email) do update set organization_id = '00000000-0000-0000-0000-000000000002';

-- 4. Backfill legacy logs to Second Servings -------------------
-- Second Mile is brand new (no logs yet), so any untagged log is Second
-- Servings'. Without this, scoping would hide pre-org logs from their admins.
update popup_logs set organization_id = '00000000-0000-0000-0000-000000000001'
where organization_id is null;

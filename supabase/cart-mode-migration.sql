-- ============================================================
-- Cart Mode migration — run ONCE in the Supabase SQL editor.
-- Idempotent and safe to re-run. Adds the Cart Mode columns and the
-- Second Mile beta org + its demo "Volunteer" driver (PIN 1234).
-- ============================================================

-- 1. Columns ---------------------------------------------------
alter table organizations add column if not exists capture_mode text default 'popup';
alter table popup_logs    add column if not exists mode text default 'popup';
alter table popup_logs    add column if not exists scale_weight_lbs numeric;

-- 2. Second Mile org (Cart Mode) -------------------------------
insert into organizations (id, name, status, capture_mode)
values ('00000000-0000-0000-0000-000000000002',
        'Second Mile',
        'approved',
        'cart')
on conflict (id) do update set status = 'approved', capture_mode = 'cart';

-- Make sure Second Servings stays on pop-up mode.
update organizations set capture_mode = 'popup'
where id = '00000000-0000-0000-0000-000000000001' and capture_mode is distinct from 'popup';

-- 3. Demo driver for Second Mile (login: "Volunteer", PIN 1234) -
insert into drivers (organization_id, name, pin)
select '00000000-0000-0000-0000-000000000002', 'Volunteer', '1234'
where not exists (
  select 1 from drivers
  where organization_id = '00000000-0000-0000-0000-000000000002'
    and name = 'Volunteer'
);

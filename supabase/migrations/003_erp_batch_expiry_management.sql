-- Batch and expiry management phase 1. Additive only; existing catalogue and live site remain untouched.
create table if not exists public.erp_medicine_batches (
  id uuid primary key default gen_random_uuid(),
  medicine_id uuid not null references public.erp_medicines(id) on delete restrict,
  batch_number text not null,
  manufacturing_date date,
  expiry_date date not null,
  purchase_price numeric(12,2) not null default 0 check (purchase_price >= 0),
  mrp numeric(12,2) not null default 0 check (mrp >= 0),
  quantity_received integer not null check (quantity_received >= 0),
  quantity_available integer not null check (quantity_available >= 0 and quantity_available <= quantity_received),
  supplier_name text,
  received_date date not null default current_date,
  notes text,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint erp_batch_number_nonblank check (length(btrim(batch_number)) > 0),
  constraint erp_batch_dates_valid check (manufacturing_date is null or expiry_date > manufacturing_date),
  constraint erp_batch_unique_per_medicine unique (medicine_id, batch_number)
);
create index if not exists erp_batches_expiry_idx on public.erp_medicine_batches(expiry_date);
create index if not exists erp_batches_medicine_idx on public.erp_medicine_batches(medicine_id);
alter table public.erp_medicine_batches enable row level security;
drop policy if exists "bmp_admin_manage_erp_batches" on public.erp_medicine_batches;
create policy "bmp_admin_manage_erp_batches" on public.erp_medicine_batches
for all to authenticated
using (auth.uid() = '7a3166f2-e4bb-42b8-a649-033dd2d02090'::uuid)
with check (auth.uid() = '7a3166f2-e4bb-42b8-a649-033dd2d02090'::uuid);
grant select, insert, update, delete on public.erp_medicine_batches to authenticated;

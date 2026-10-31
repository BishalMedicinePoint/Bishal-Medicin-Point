-- Bishal Medicine Point ERP: Phase 1 customer management
-- Run once in Supabase SQL Editor after reviewing this migration.
-- Existing public.medicines table is not changed.

create sequence if not exists public.customer_code_seq;

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  customer_id text unique,
  customer_name text not null,
  mobile_number text not null,
  alternative_phone text,
  email text,
  mid text,
  reference_partner text,
  customer_type text not null default 'Regular',
  address text,
  previous_due numeric(12,2) not null default 0 check (previous_due >= 0),
  credit_limit numeric(12,2) not null default 0 check (credit_limit >= 0),
  photo_path text,
  notes text,
  registration_date date not null default current_date,
  is_active boolean not null default true,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.customer_ledger (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id),
  entry_type text not null check (entry_type in ('opening_due','sale_due','collection','adjustment','sales_return')),
  amount numeric(12,2) not null check (amount >= 0),
  note text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists customers_mobile_idx on public.customers(mobile_number);
create index if not exists customers_name_idx on public.customers(customer_name);
create index if not exists customer_ledger_customer_idx on public.customer_ledger(customer_id, created_at desc);

create or replace function public.bmp_assign_customer_code()
returns trigger language plpgsql as $$
begin
  if new.customer_id is null or new.customer_id = '' then
    new.customer_id := 'BMP-C-' || to_char(current_date, 'YYYY') || '-' || lpad(nextval('public.customer_code_seq')::text, 6, '0');
  end if;
  if new.created_by is null then new.created_by := auth.uid(); end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists bmp_customers_before_insert on public.customers;
create trigger bmp_customers_before_insert
before insert on public.customers
for each row execute function public.bmp_assign_customer_code();

create or replace function public.bmp_record_opening_due()
returns trigger language plpgsql as $$
begin
  if new.previous_due > 0 then
    insert into public.customer_ledger(customer_id, entry_type, amount, note, created_by)
    values(new.id, 'opening_due', new.previous_due, 'Customer opening due balance', auth.uid());
  end if;
  return new;
end;
$$;

drop trigger if exists bmp_customer_opening_due on public.customers;
create trigger bmp_customer_opening_due
after insert on public.customers
for each row execute function public.bmp_record_opening_due();

alter table public.customers enable row level security;
alter table public.customer_ledger enable row level security;

drop policy if exists "bmp_admin_manage_customers" on public.customers;
create policy "bmp_admin_manage_customers" on public.customers
for all to authenticated
using (auth.uid() = '7a3166f2-e4bb-42b8-a649-033dd2d02090'::uuid)
with check (auth.uid() = '7a3166f2-e4bb-42b8-a649-033dd2d02090'::uuid);

drop policy if exists "bmp_admin_manage_customer_ledger" on public.customer_ledger;
create policy "bmp_admin_manage_customer_ledger" on public.customer_ledger
for all to authenticated
using (auth.uid() = '7a3166f2-e4bb-42b8-a649-033dd2d02090'::uuid)
with check (auth.uid() = '7a3166f2-e4bb-42b8-a649-033dd2d02090'::uuid);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('customer-photos', 'customer-photos', false, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public=false, file_size_limit=5242880, allowed_mime_types=array['image/jpeg','image/png','image/webp'];

drop policy if exists "bmp_admin_upload_customer_photos" on storage.objects;
create policy "bmp_admin_upload_customer_photos" on storage.objects
for insert to authenticated
with check (bucket_id='customer-photos' and auth.uid()='7a3166f2-e4bb-42b8-a649-033dd2d02090'::uuid and (storage.foldername(name))[1]=auth.uid()::text);

drop policy if exists "bmp_admin_read_customer_photos" on storage.objects;
create policy "bmp_admin_read_customer_photos" on storage.objects
for select to authenticated
using (bucket_id='customer-photos' and auth.uid()='7a3166f2-e4bb-42b8-a649-033dd2d02090'::uuid and (storage.foldername(name))[1]=auth.uid()::text);

drop policy if exists "bmp_admin_update_customer_photos" on storage.objects;
create policy "bmp_admin_update_customer_photos" on storage.objects
for update to authenticated
using (bucket_id='customer-photos' and auth.uid()='7a3166f2-e4bb-42b8-a649-033dd2d02090'::uuid and (storage.foldername(name))[1]=auth.uid()::text)
with check (bucket_id='customer-photos' and auth.uid()='7a3166f2-e4bb-42b8-a649-033dd2d02090'::uuid and (storage.foldername(name))[1]=auth.uid()::text);

drop policy if exists "bmp_admin_delete_customer_photos" on storage.objects;
create policy "bmp_admin_delete_customer_photos" on storage.objects
for delete to authenticated
using (bucket_id='customer-photos' and auth.uid()='7a3166f2-e4bb-42b8-a649-033dd2d02090'::uuid and (storage.foldername(name))[1]=auth.uid()::text);

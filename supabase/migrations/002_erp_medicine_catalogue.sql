-- Medicine catalogue for ERP. Additive: does not alter public.medicines or create stock.
create table if not exists public.erp_medicines (
 id uuid primary key default gen_random_uuid(),
 medicine_name text not null,
 generic_name text,
 brand text,
 therapeutic_group text,
 dosage_form text not null default 'Tablet',
 strength text,
 pack_size text,
 manufacturer text,
 barcode text,
 purchase_price numeric(12,2) not null default 0 check (purchase_price>=0),
 selling_price numeric(12,2) not null default 0 check (selling_price>=0),
 mrp numeric(12,2) not null default 0 check (mrp>=0),
 box_price numeric(12,2) check (box_price is null or box_price>=0),
 strip_price numeric(12,2) check (strip_price is null or strip_price>=0),
 unit_price numeric(12,2) check (unit_price is null or unit_price>=0),
 units_per_strip integer not null default 0 check (units_per_strip>=0),
 strips_per_box integer not null default 0 check (strips_per_box>=0),
 sale_units_allowed text,
 description text,
 is_active boolean not null default true,
 created_by uuid references auth.users(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists erp_medicines_name_idx on public.erp_medicines (lower(medicine_name));
create index if not exists erp_medicines_barcode_idx on public.erp_medicines (barcode) where barcode is not null;
alter table public.erp_medicines enable row level security;
drop policy if exists bmp_admin_manage_erp_medicines on public.erp_medicines;
create policy bmp_admin_manage_erp_medicines on public.erp_medicines for all to authenticated
using ((select auth.uid())='7a3166f2-e4bb-42b8-a649-033dd2d02090'::uuid)
with check ((select auth.uid())='7a3166f2-e4bb-42b8-a649-033dd2d02090'::uuid);
grant select,insert,update,delete on public.erp_medicines to authenticated;

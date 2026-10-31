create table public.erp_employee_permissions (
 id uuid primary key default gen_random_uuid(),
 employee_id uuid not null references public.erp_employees(id) on delete cascade,
 module_key text not null check (module_key in ('customers','medicines','batches','barcode','pos','purchases','stock','customer_due','sales_returns','purchase_returns','employees','attendance')),
 can_view boolean not null default false,
 can_create boolean not null default false,
 can_update boolean not null default false,
 can_delete boolean not null default false,
 can_approve boolean not null default false,
 can_print boolean not null default false,
 updated_by uuid not null default auth.uid() references auth.users(id),
 updated_at timestamptz not null default now(),
 unique(employee_id,module_key)
);
create index erp_employee_permissions_employee_idx on public.erp_employee_permissions(employee_id);
alter table public.erp_employee_permissions enable row level security;
create policy bmp_admin_manage_employee_permissions on public.erp_employee_permissions for all to authenticated using (auth.uid()='7a3166f2-e4bb-42b8-a649-033dd2d02090'::uuid) with check (auth.uid()='7a3166f2-e4bb-42b8-a649-033dd2d02090'::uuid);
grant select,insert,update,delete on public.erp_employee_permissions to authenticated;

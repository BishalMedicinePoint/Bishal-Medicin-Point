create table public.erp_employee_payroll (
 id uuid primary key default gen_random_uuid(),
 employee_id uuid not null references public.erp_employees(id) on delete restrict,
 payroll_month date not null,
 basic_salary numeric(12,2) not null default 0 check (basic_salary>=0),
 allowances numeric(12,2) not null default 0 check (allowances>=0),
 bonus numeric(12,2) not null default 0 check (bonus>=0),
 deductions numeric(12,2) not null default 0 check (deductions>=0),
 net_salary numeric(12,2) generated always as (basic_salary+allowances+bonus-deductions) stored,
 payment_status text not null default 'pending' check(payment_status in ('pending','paid')),
 paid_date date,
 payment_method text,
 notes text,
 created_by uuid not null default auth.uid() references auth.users(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(employee_id,payroll_month),
 check(deductions<=basic_salary+allowances+bonus),
 check((payment_status='paid' and paid_date is not null) or (payment_status='pending' and paid_date is null))
);
create index erp_employee_payroll_month_idx on public.erp_employee_payroll(payroll_month desc);
create index erp_employee_payroll_employee_idx on public.erp_employee_payroll(employee_id,payroll_month desc);
alter table public.erp_employee_payroll enable row level security;
create policy bmp_admin_manage_employee_payroll on public.erp_employee_payroll for all to authenticated using(auth.uid()='7a3166f2-e4bb-42b8-a649-033dd2d02090'::uuid) with check(auth.uid()='7a3166f2-e4bb-42b8-a649-033dd2d02090'::uuid);
grant select,insert,update,delete on public.erp_employee_payroll to authenticated;
create or replace function public.bmp_touch_employee_payroll_updated_at()
returns trigger language plpgsql set search_path='' as $$
begin new.updated_at=now(); return new; end;
$$;
create trigger bmp_employee_payroll_updated_at before update on public.erp_employee_payroll for each row execute function public.bmp_touch_employee_payroll_updated_at();

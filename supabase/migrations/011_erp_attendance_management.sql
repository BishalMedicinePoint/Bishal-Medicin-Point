create table public.erp_attendance (
 id uuid primary key default gen_random_uuid(),
 employee_id uuid not null references public.erp_employees(id) on delete restrict,
 attendance_date date not null default current_date,
 attendance_status text not null default 'present' check (attendance_status in ('present','absent','leave','holiday')),
 check_in time,
 check_out time,
 notes text,
 created_by uuid not null default auth.uid() references auth.users(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint erp_attendance_employee_date_key unique(employee_id, attendance_date),
 constraint erp_attendance_time_order check (check_in is null or check_out is null or check_out >= check_in)
);
create index erp_attendance_date_idx on public.erp_attendance(attendance_date desc);
create index erp_attendance_employee_date_idx on public.erp_attendance(employee_id, attendance_date desc);
alter table public.erp_attendance enable row level security;
create policy bmp_admin_manage_erp_attendance on public.erp_attendance for all to authenticated using (auth.uid() = '7a3166f2-e4bb-42b8-a649-033dd2d02090'::uuid) with check (auth.uid() = '7a3166f2-e4bb-42b8-a649-033dd2d02090'::uuid);
grant select, insert, update, delete on public.erp_attendance to authenticated;

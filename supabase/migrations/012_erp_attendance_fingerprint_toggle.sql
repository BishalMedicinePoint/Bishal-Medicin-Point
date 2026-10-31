create table public.erp_attendance_settings (id boolean primary key default true check (id = true), fingerprint_enabled boolean not null default false, updated_by uuid references auth.users(id), updated_at timestamptz not null default now());
alter table public.erp_attendance_settings enable row level security;
create policy bmp_admin_manage_attendance_settings on public.erp_attendance_settings for all to authenticated using (auth.uid() = '7a3166f2-e4bb-42b8-a649-033dd2d02090'::uuid) with check (auth.uid() = '7a3166f2-e4bb-42b8-a649-033dd2d02090'::uuid);
grant select, insert, update on public.erp_attendance_settings to authenticated;
insert into public.erp_attendance_settings(id,fingerprint_enabled) values(true,false) on conflict(id) do nothing;
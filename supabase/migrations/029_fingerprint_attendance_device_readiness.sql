alter table public.erp_attendance
  add column if not exists check_in_method text not null default 'manual',
  add column if not exists check_out_method text not null default 'manual';

alter table public.erp_attendance_settings
  add column if not exists fingerprint_device_name text,
  add column if not exists fingerprint_model text,
  add column if not exists fingerprint_connection text,
  add column if not exists fingerprint_serial text,
  add column if not exists fingerprint_branch_id uuid references public.erp_branches(id) on delete set null;

alter table public.erp_attendance
  drop constraint if exists erp_attendance_check_in_method_check,
  add constraint erp_attendance_check_in_method_check
    check (check_in_method in ('manual','fingerprint')),
  drop constraint if exists erp_attendance_check_out_method_check,
  add constraint erp_attendance_check_out_method_check
    check (check_out_method in ('manual','fingerprint'));

comment on column public.erp_attendance.check_in_method is 'Attendance capture method: manual or fingerprint device integration';
comment on column public.erp_attendance.check_out_method is 'Attendance capture method: manual or fingerprint device integration';
comment on column public.erp_attendance_settings.fingerprint_connection is 'Planned device connection: usb, lan, wifi, or vendor_bridge';
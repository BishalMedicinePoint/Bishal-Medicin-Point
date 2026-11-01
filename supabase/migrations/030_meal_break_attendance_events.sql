alter table public.erp_attendance
  add column if not exists meal_break_out time,
  add column if not exists meal_break_in time,
  add column if not exists meal_break_out_method text not null default 'manual',
  add column if not exists meal_break_in_method text not null default 'manual';

alter table public.erp_attendance
  drop constraint if exists erp_attendance_meal_break_out_method_check,
  add constraint erp_attendance_meal_break_out_method_check
    check (meal_break_out_method in ('manual','fingerprint')),
  drop constraint if exists erp_attendance_meal_break_in_method_check,
  add constraint erp_attendance_meal_break_in_method_check
    check (meal_break_in_method in ('manual','fingerprint')),
  drop constraint if exists erp_attendance_meal_break_order_check,
  add constraint erp_attendance_meal_break_order_check
    check (meal_break_out is null or meal_break_in is null or meal_break_in >= meal_break_out);

comment on column public.erp_attendance.meal_break_out is 'Time employee scans fingerprint to leave for meal break';
comment on column public.erp_attendance.meal_break_in is 'Time employee scans fingerprint after returning from meal break';
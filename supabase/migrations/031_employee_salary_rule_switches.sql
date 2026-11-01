alter table public.erp_employees
  add column if not exists salary_deduction_enabled boolean not null default true,
  add column if not exists overtime_enabled boolean not null default true,
  add column if not exists leave_deduction_enabled boolean not null default true,
  add column if not exists unused_leave_bonus_enabled boolean not null default true;

comment on column public.erp_employees.salary_deduction_enabled is 'Whether salary deductions are enabled for this employee.';
comment on column public.erp_employees.overtime_enabled is 'Whether overtime pay is enabled for this employee.';
comment on column public.erp_employees.leave_deduction_enabled is 'Whether excess leave deductions are enabled for this employee.';
comment on column public.erp_employees.unused_leave_bonus_enabled is 'Whether unused monthly leave bonus is enabled for this employee.';

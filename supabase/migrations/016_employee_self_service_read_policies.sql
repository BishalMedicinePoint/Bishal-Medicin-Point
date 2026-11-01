-- Employee self-service read policies.
-- Employees can read only their own records, and only when the matching
-- module's explicit view permission is enabled.

drop policy if exists bmp_employee_read_own_profile on public.erp_employees;
create policy bmp_employee_read_own_profile
on public.erp_employees
for select
to authenticated
using (
  auth_user_id = (select auth.uid())
  and login_enabled = true
  and employment_status = 'active'
  and public.bmp_has_employee_permission('employees','view')
);

drop policy if exists bmp_employee_read_own_attendance on public.erp_attendance;
create policy bmp_employee_read_own_attendance
on public.erp_attendance
for select
to authenticated
using (
  exists (
    select 1
    from public.erp_employees e
    where e.id = erp_attendance.employee_id
      and e.auth_user_id = (select auth.uid())
      and e.login_enabled = true
      and e.employment_status = 'active'
  )
  and public.bmp_has_employee_permission('attendance','view')
);

drop policy if exists bmp_employee_read_own_payroll on public.erp_employee_payroll;
create policy bmp_employee_read_own_payroll
on public.erp_employee_payroll
for select
to authenticated
using (
  exists (
    select 1
    from public.erp_employees e
    where e.id = erp_employee_payroll.employee_id
      and e.auth_user_id = (select auth.uid())
      and e.login_enabled = true
      and e.employment_status = 'active'
  )
  and public.bmp_has_employee_permission('payroll','view')
);

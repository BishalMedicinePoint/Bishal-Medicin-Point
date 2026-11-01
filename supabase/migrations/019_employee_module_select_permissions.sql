-- Employee module SELECT permissions, limited to assigned branch where applicable.
-- Writes remain restricted to Super Admin or dedicated guarded RPCs.
create or replace function public.bmp_employee_has_branch_access(p_branch_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.erp_employees e
    where e.auth_user_id = (select auth.uid())
      and e.login_enabled = true
      and e.employment_status = 'active'
      and e.branch_id = p_branch_id
  );
$function$;

revoke all on function public.bmp_employee_has_branch_access(uuid) from public, anon;
grant execute on function public.bmp_employee_has_branch_access(uuid) to authenticated;

drop policy if exists bmp_employee_view_medicines on public.erp_medicines;
create policy bmp_employee_view_medicines
on public.erp_medicines for select to authenticated
using (public.bmp_has_employee_permission('medicines','view'));

drop policy if exists bmp_employee_view_batches on public.erp_medicine_batches;
create policy bmp_employee_view_batches
on public.erp_medicine_batches for select to authenticated
using (
  public.bmp_has_employee_permission('batches','view')
  and public.bmp_employee_has_branch_access(branch_id)
);

drop policy if exists bmp_employee_view_suppliers on public.erp_suppliers;
create policy bmp_employee_view_suppliers
on public.erp_suppliers for select to authenticated
using (public.bmp_has_employee_permission('suppliers','view'));

drop policy if exists bmp_employee_view_employees_branch on public.erp_employees;
create policy bmp_employee_view_employees_branch
on public.erp_employees for select to authenticated
using (
  public.bmp_has_employee_permission('employees','view')
  and public.bmp_employee_has_branch_access(branch_id)
);

drop policy if exists bmp_employee_view_attendance_branch on public.erp_attendance;
create policy bmp_employee_view_attendance_branch
on public.erp_attendance for select to authenticated
using (
  public.bmp_has_employee_permission('attendance','view')
  and public.bmp_employee_has_branch_access(branch_id)
);

drop policy if exists bmp_employee_view_payroll_branch on public.erp_employee_payroll;
create policy bmp_employee_view_payroll_branch
on public.erp_employee_payroll for select to authenticated
using (
  public.bmp_has_employee_permission('payroll','view')
  and public.bmp_employee_has_branch_access(branch_id)
);

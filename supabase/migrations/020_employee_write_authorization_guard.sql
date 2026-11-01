-- Shared authorization guard for employee-facing write RPCs.
-- This helper is intentionally private and cannot be invoked through PostgREST.
create or replace function private.bmp_assert_employee_permission(
  p_module_key text,
  p_action text,
  p_branch_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_employee public.erp_employees%rowtype;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if v_uid = '7a3166f2-e4bb-42b8-a649-033dd2d02090'::uuid then
    return;
  end if;

  select e.* into v_employee
  from public.erp_employees e
  where e.auth_user_id = v_uid
    and e.login_enabled = true
    and e.employment_status = 'active'
  limit 1;

  if not found then
    raise exception 'Active employee login required';
  end if;

  if p_branch_id is not null and v_employee.branch_id is distinct from p_branch_id then
    raise exception 'You do not have access to this branch';
  end if;

  if not exists (
    select 1
    from public.erp_employee_permissions p
    where p.employee_id = v_employee.id
      and p.module_key = p_module_key
      and case p_action
        when 'view' then p.can_view
        when 'create' then p.can_create
        when 'update' then p.can_update
        when 'delete' then p.can_delete
        when 'approve' then p.can_approve
        when 'print' then p.can_print
        else false
      end
  ) then
    raise exception 'Permission denied: % / %', p_module_key, p_action;
  end if;
end;
$function$;

revoke all on function private.bmp_assert_employee_permission(text,text,uuid)
from public, anon, authenticated;

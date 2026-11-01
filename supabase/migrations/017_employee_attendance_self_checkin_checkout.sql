create or replace function public.bmp_employee_attendance_action(p_action text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_employee public.erp_employees%rowtype;
  v_today date := (now() at time zone 'Asia/Dhaka')::date;
  v_now time := (now() at time zone 'Asia/Dhaka')::time;
  v_row public.erp_attendance%rowtype;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;

  if p_action not in ('check_in','check_out') then
    raise exception 'Invalid attendance action';
  end if;

  select e.* into v_employee
  from public.erp_employees e
  where e.auth_user_id = (select auth.uid())
    and e.login_enabled = true
    and e.employment_status = 'active'
  limit 1;

  if not found then
    raise exception 'Active employee login is not linked';
  end if;

  if p_action = 'check_in' then
    if not public.bmp_has_employee_permission('attendance','create') then
      raise exception 'Attendance check-in permission is not enabled';
    end if;

    insert into public.erp_attendance
      (employee_id, attendance_date, attendance_status, check_in, branch_id, created_by)
    values
      (v_employee.id, v_today, 'present', v_now, v_employee.branch_id, (select auth.uid()))
    on conflict (employee_id, attendance_date) do nothing;

    select a.* into v_row
    from public.erp_attendance a
    where a.employee_id = v_employee.id
      and a.attendance_date = v_today;

    if v_row.check_in is null then
      update public.erp_attendance a
      set check_in = v_now,
          attendance_status = 'present',
          branch_id = v_employee.branch_id,
          updated_at = now()
      where a.id = v_row.id
      returning a.* into v_row;
      return jsonb_build_object('ok',true,'action','check_in','message','Check-in recorded');
    end if;

    return jsonb_build_object('ok',true,'action','check_in','message','Already checked in','attendance_date',v_row.attendance_date,'check_in',v_row.check_in,'check_out',v_row.check_out);
  end if;

  if not public.bmp_has_employee_permission('attendance','update') then
    raise exception 'Attendance check-out permission is not enabled';
  end if;

  update public.erp_attendance a
  set check_out = v_now,
      updated_at = now()
  where a.employee_id = v_employee.id
    and a.attendance_date = v_today
    and a.check_in is not null
    and a.check_out is null
  returning a.* into v_row;

  if not found then
    select a.* into v_row
    from public.erp_attendance a
    where a.employee_id = v_employee.id
      and a.attendance_date = v_today;

    if not found then
      raise exception 'No check-in found for today';
    end if;
    return jsonb_build_object('ok',true,'action','check_out','message','Already checked out','attendance_date',v_row.attendance_date,'check_in',v_row.check_in,'check_out',v_row.check_out);
  end if;

  return jsonb_build_object('ok',true,'action','check_out','message','Check-out recorded','attendance_date',v_row.attendance_date,'check_in',v_row.check_in,'check_out',v_row.check_out);
end;
$function$;

revoke all on function public.bmp_employee_attendance_action(text) from public, anon;
grant execute on function public.bmp_employee_attendance_action(text) to authenticated;

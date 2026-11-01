-- Employee-specific duty, leave, salary switches and attendance-based monthly payroll.
alter table public.erp_employees
  add column if not exists duty_start_time time not null default time '08:00',
  add column if not exists duty_end_time time not null default time '21:00',
  add column if not exists meal_break_minutes integer not null default 40,
  add column if not exists monthly_leave_days integer not null default 2,
  add column if not exists salary_day_divisor numeric(6,2) not null default 30,
  add column if not exists overtime_hourly_rate numeric(12,2);

alter table public.erp_employee_payroll
  add column if not exists late_minutes integer not null default 0,
  add column if not exists absent_days integer not null default 0,
  add column if not exists leave_days integer not null default 0,
  add column if not exists unused_leave_days integer not null default 0,
  add column if not exists overtime_minutes integer not null default 0,
  add column if not exists late_deduction_amount numeric(12,2) not null default 0,
  add column if not exists absence_deduction_amount numeric(12,2) not null default 0,
  add column if not exists leave_deduction_amount numeric(12,2) not null default 0,
  add column if not exists unused_leave_bonus_amount numeric(12,2) not null default 0,
  add column if not exists overtime_amount numeric(12,2) not null default 0;

alter table public.erp_employees
  drop constraint if exists erp_employees_payroll_settings_check;
alter table public.erp_employees
  add constraint erp_employees_payroll_settings_check
  check (
    meal_break_minutes between 0 and 240
    and monthly_leave_days between 0 and 31
    and salary_day_divisor > 0 and salary_day_divisor <= 31
    and (overtime_hourly_rate is null or overtime_hourly_rate >= 0)
    and duty_start_time <> duty_end_time
  );

CREATE OR REPLACE FUNCTION public.bmp_is_manager_for_branch(p_branch_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$ select exists (select 1 from public.erp_employees e where e.auth_user_id=(select auth.uid()) and e.login_enabled=true and e.employment_status='active' and e.system_role='manager' and e.branch_id=p_branch_id); $function$

revoke all on function public.bmp_is_manager_for_branch(uuid) from public, anon;
grant execute on function public.bmp_is_manager_for_branch(uuid) to authenticated;

drop policy if exists bmp_manager_view_employees_branch on public.erp_employees;
create policy bmp_manager_view_employees_branch on public.erp_employees
for select to authenticated
using (public.bmp_is_manager_for_branch(branch_id));

drop policy if exists bmp_manager_view_payroll_branch on public.erp_employee_payroll;
create policy bmp_manager_view_payroll_branch on public.erp_employee_payroll
for select to authenticated
using (public.bmp_is_manager_for_branch(branch_id));

CREATE OR REPLACE FUNCTION public.bmp_update_employee_pay_rules(p_employee_id uuid, p_salary_deduction_enabled boolean, p_overtime_enabled boolean, p_leave_deduction_enabled boolean, p_unused_leave_bonus_enabled boolean, p_duty_start_time time without time zone, p_duty_end_time time without time zone, p_meal_break_minutes integer, p_monthly_leave_days integer, p_salary_day_divisor numeric, p_overtime_hourly_rate numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ declare v_employee public.erp_employees%rowtype; begin if (select auth.uid()) is null then raise exception 'Authentication required'; end if; select * into v_employee from public.erp_employees where id=p_employee_id for update; if not found then raise exception 'Employee not found'; end if; if (select auth.uid()) <> '7a3166f2-e4bb-42b8-a649-033dd2d02090'::uuid and not public.bmp_is_manager_for_branch(v_employee.branch_id) then raise exception 'Not authorized for this employee branch'; end if; if p_duty_start_time is null or p_duty_end_time is null or p_duty_start_time=p_duty_end_time or p_meal_break_minutes not between 0 and 240 or p_monthly_leave_days not between 0 and 31 or p_salary_day_divisor is null or p_salary_day_divisor<=0 or p_salary_day_divisor>31 or (p_overtime_hourly_rate is not null and p_overtime_hourly_rate<0) then raise exception 'Invalid duty or payroll settings'; end if; update public.erp_employees set salary_deduction_enabled=coalesce(p_salary_deduction_enabled,true),overtime_enabled=coalesce(p_overtime_enabled,true),leave_deduction_enabled=coalesce(p_leave_deduction_enabled,true),unused_leave_bonus_enabled=coalesce(p_unused_leave_bonus_enabled,true),duty_start_time=p_duty_start_time,duty_end_time=p_duty_end_time,meal_break_minutes=p_meal_break_minutes,monthly_leave_days=p_monthly_leave_days,salary_day_divisor=p_salary_day_divisor,overtime_hourly_rate=p_overtime_hourly_rate,updated_at=now() where id=p_employee_id; return jsonb_build_object('success',true,'employee_id',p_employee_id); end; $function$

revoke all on function public.bmp_update_employee_pay_rules(uuid,boolean,boolean,boolean,boolean,time,time,integer,integer,numeric,numeric) from public, anon;
grant execute on function public.bmp_update_employee_pay_rules(uuid,boolean,boolean,boolean,boolean,time,time,integer,integer,numeric,numeric) to authenticated;

CREATE OR REPLACE FUNCTION public.bmp_calculate_employee_payroll(p_employee_id uuid, p_payroll_month date)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$ select jsonb_build_object('late_minutes',coalesce(a.late_minutes,0),'absent_days',coalesce(a.absent_days,0),'leave_days',coalesce(a.leave_days,0),'unused_leave_days',greatest(0,e.monthly_leave_days-coalesce(a.leave_days,0)),'overtime_minutes',coalesce(a.overtime_minutes,0),'monthly_leave_days',e.monthly_leave_days,'salary_deduction_enabled',e.salary_deduction_enabled,'overtime_enabled',e.overtime_enabled,'leave_deduction_enabled',e.leave_deduction_enabled,'unused_leave_bonus_enabled',e.unused_leave_bonus_enabled,'salary_day_divisor',e.salary_day_divisor,'scheduled_minutes',greatest(1,extract(epoch from (e.duty_end_time-e.duty_start_time))/60-e.meal_break_minutes),'overtime_hourly_rate',e.overtime_hourly_rate) from public.erp_employees e left join lateral (select count(*) filter(where x.attendance_status='absent')::integer absent_days,count(*) filter(where x.attendance_status='leave')::integer leave_days,coalesce(sum(case when x.attendance_status='present' and x.check_in>e.duty_start_time then ceil(extract(epoch from (x.check_in-e.duty_start_time))/60.0)::integer else 0 end),0)::integer late_minutes,coalesce(sum(case when x.attendance_status='present' and x.check_in is not null and x.check_out is not null then greatest(0,floor(greatest(0,extract(epoch from (x.check_out-x.check_in))/60.0-coalesce(extract(epoch from (x.meal_break_in-x.meal_break_out))/60.0,e.meal_break_minutes))-greatest(1,extract(epoch from (e.duty_end_time-e.duty_start_time))/60-e.meal_break_minutes)))::integer else 0 end),0)::integer overtime_minutes from public.erp_attendance x where x.employee_id=e.id and x.attendance_date>=p_payroll_month and x.attendance_date<(p_payroll_month+interval '1 month')::date) a on true where e.id=p_employee_id and e.employment_status<>'resigned' and ((select auth.uid())='7a3166f2-e4bb-42b8-a649-033dd2d02090'::uuid or public.bmp_is_manager_for_branch(e.branch_id) or exists(select 1 from public.erp_employees own where own.id=e.id and own.auth_user_id=(select auth.uid()) and own.login_enabled=true)); $function$

revoke all on function public.bmp_calculate_employee_payroll(uuid,date) from public, anon;
grant execute on function public.bmp_calculate_employee_payroll(uuid,date) to authenticated;

CREATE OR REPLACE FUNCTION public.bmp_save_payroll(p_employee_id uuid, p_payroll_month date, p_basic numeric, p_allowances numeric, p_bonus numeric, p_deductions numeric, p_status text, p_paid_date date, p_payment_method text, p_notes text, p_account_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ declare v_row public.erp_employee_payroll%rowtype; v_account public.erp_accounts%rowtype; v_employee public.erp_employees%rowtype; v_calc jsonb; v_daily numeric(12,4); v_hourly numeric(12,4); v_late integer; v_absent integer; v_leave integer; v_unused integer; v_overtime integer; v_late_deduction numeric(12,2):=0; v_absence_deduction numeric(12,2):=0; v_leave_deduction numeric(12,2):=0; v_leave_bonus numeric(12,2):=0; v_overtime_amount numeric(12,2):=0; v_total_bonus numeric(12,2); v_total_deductions numeric(12,2); v_net numeric(12,2); v_found boolean:=false; v_is_admin boolean:=(select auth.uid())='7a3166f2-e4bb-42b8-a649-033dd2d02090'::uuid; begin if (select auth.uid()) is null then raise exception 'Authentication required'; end if; if p_employee_id is null or p_payroll_month is null or extract(day from p_payroll_month)<>1 then raise exception 'Invalid employee or payroll month'; end if; select * into v_employee from public.erp_employees where id=p_employee_id and employment_status<>'resigned' for update; if not found or v_employee.branch_id is null then raise exception 'Employee branch is missing or employee unavailable'; end if; if not v_is_admin and not public.bmp_is_manager_for_branch(v_employee.branch_id) then raise exception 'Not authorized for this employee branch'; end if; if not v_is_admin and p_status<>'pending' then raise exception 'Manager can prepare pending payroll only; Super Admin must mark it paid'; end if; if p_basic is null or p_allowances is null or p_bonus is null or p_deductions is null or least(p_basic,p_allowances,p_bonus,p_deductions)<0 then raise exception 'Salary amounts must be zero or greater'; end if; if p_status not in ('pending','paid') then raise exception 'Invalid payroll status'; end if; v_calc:=public.bmp_calculate_employee_payroll(p_employee_id,p_payroll_month); if v_calc is null then raise exception 'Attendance calculation unavailable'; end if; v_late:=(v_calc->>'late_minutes')::integer; v_absent:=(v_calc->>'absent_days')::integer; v_leave:=(v_calc->>'leave_days')::integer; v_unused:=(v_calc->>'unused_leave_days')::integer; v_overtime:=(v_calc->>'overtime_minutes')::integer; v_daily:=round(p_basic/nullif((v_calc->>'salary_day_divisor')::numeric,0),4); v_hourly:=coalesce((v_calc->>'overtime_hourly_rate')::numeric,v_daily*60/greatest(1,(v_calc->>'scheduled_minutes')::numeric)); if (v_calc->>'salary_deduction_enabled')::boolean then v_late_deduction:=round(v_daily/greatest(1,(v_calc->>'scheduled_minutes')::numeric)*v_late,2); v_absence_deduction:=round(v_daily*v_absent,2); end if; if (v_calc->>'leave_deduction_enabled')::boolean then v_leave_deduction:=round(v_daily*greatest(0,v_leave-(v_calc->>'monthly_leave_days')::integer),2); end if; if (v_calc->>'unused_leave_bonus_enabled')::boolean then v_leave_bonus:=round(v_daily*v_unused,2); end if; if (v_calc->>'overtime_enabled')::boolean then v_overtime_amount:=round(v_overtime/60.0*v_hourly,2); end if; v_total_bonus:=round(p_bonus+v_leave_bonus+v_overtime_amount,2); v_total_deductions:=round(p_deductions+v_late_deduction+v_absence_deduction+v_leave_deduction,2); v_net:=round(p_basic+p_allowances+v_total_bonus-v_total_deductions,2); if v_net<0 then raise exception 'Net salary cannot be negative'; end if; if p_status='paid' then if p_paid_date is null or p_account_id is null then raise exception 'Paid payroll requires paid date and account'; end if; select * into v_account from public.erp_accounts where id=p_account_id and is_active for update; if not found then raise exception 'Selected salary account is unavailable'; end if; elsif p_paid_date is not null then raise exception 'Pending payroll must not have a paid date'; end if; select * into v_row from public.erp_employee_payroll where employee_id=p_employee_id and payroll_month=p_payroll_month for update; v_found:=found; if v_found and v_row.payment_status='paid' then raise exception 'Paid payroll is locked to prevent duplicate or mismatched account posting'; end if; if v_found then update public.erp_employee_payroll set branch_id=v_employee.branch_id,basic_salary=p_basic,allowances=p_allowances,bonus=v_total_bonus,deductions=v_total_deductions,net_salary=v_net,payment_status=p_status,paid_date=p_paid_date,payment_method=nullif(btrim(p_payment_method),''),notes=nullif(btrim(p_notes),''),account_id=case when p_status='paid' then p_account_id else null end,late_minutes=v_late,absent_days=v_absent,leave_days=v_leave,unused_leave_days=v_unused,overtime_minutes=v_overtime,late_deduction_amount=v_late_deduction,absence_deduction_amount=v_absence_deduction,leave_deduction_amount=v_leave_deduction,unused_leave_bonus_amount=v_leave_bonus,overtime_amount=v_overtime_amount,updated_at=now() where id=v_row.id returning * into v_row; else insert into public.erp_employee_payroll(employee_id,branch_id,payroll_month,basic_salary,allowances,bonus,deductions,net_salary,payment_status,paid_date,payment_method,notes,created_by,account_id,late_minutes,absent_days,leave_days,unused_leave_days,overtime_minutes,late_deduction_amount,absence_deduction_amount,leave_deduction_amount,unused_leave_bonus_amount,overtime_amount) values(p_employee_id,v_employee.branch_id,p_payroll_month,p_basic,p_allowances,v_total_bonus,v_total_deductions,v_net,p_status,p_paid_date,nullif(btrim(p_payment_method),''),nullif(btrim(p_notes),''),(select auth.uid()),case when p_status='paid' then p_account_id else null end,v_late,v_absent,v_leave,v_unused,v_overtime,v_late_deduction,v_absence_deduction,v_leave_deduction,v_leave_bonus,v_overtime_amount) returning * into v_row; end if; if p_status='paid' then insert into public.erp_account_transactions(account_id,transaction_date,transaction_type,category,amount,reference_number,description,created_by) values(p_account_id,p_paid_date,'expense','Salary Payment',v_net,'PAYROLL-'||v_row.id::text,'Salary payment for employee '||p_employee_id::text||' ('||to_char(p_payroll_month,'YYYY-MM')||')',(select auth.uid())) returning id into v_row.account_transaction_id; update public.erp_employee_payroll set account_transaction_id=v_row.account_transaction_id where id=v_row.id; end if; return jsonb_build_object('payroll_id',v_row.id,'net_salary',v_net,'payment_status',p_status,'account_transaction_id',v_row.account_transaction_id,'branch_id',v_employee.branch_id,'late_minutes',v_late,'absent_days',v_absent,'leave_days',v_leave,'unused_leave_days',v_unused,'overtime_minutes',v_overtime,'late_deduction',v_late_deduction,'absence_deduction',v_absence_deduction,'leave_deduction',v_leave_deduction,'unused_leave_bonus',v_leave_bonus,'overtime_amount',v_overtime_amount); end; $function$

revoke all on function public.bmp_save_payroll(uuid,date,numeric,numeric,numeric,numeric,text,date,text,text,uuid) from public, anon;
grant execute on function public.bmp_save_payroll(uuid,date,numeric,numeric,numeric,numeric,text,date,text,text,uuid) to authenticated;

CREATE OR REPLACE FUNCTION public.bmp_get_my_erp_access()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$ declare v_employee public.erp_employees%rowtype; v_permissions jsonb; begin select e.* into v_employee from public.erp_employees e where e.auth_user_id=(select auth.uid()) and e.login_enabled=true and e.employment_status='active' limit 1; if not found then return jsonb_build_object('authorized',false,'is_super_admin',(select auth.uid())='7a3166f2-e4bb-42b8-a649-033dd2d02090'::uuid); end if; select coalesce(jsonb_object_agg(p.module_key,jsonb_build_object('view',p.can_view,'create',p.can_create,'update',p.can_update,'delete',p.can_delete,'approve',p.can_approve,'print',p.can_print)), '{}'::jsonb) into v_permissions from public.erp_employee_permissions p where p.employee_id=v_employee.id; return jsonb_build_object('authorized',true,'employee_id',v_employee.id,'employee_code',v_employee.employee_code,'full_name',v_employee.full_name,'job_title',v_employee.job_title,'system_role',v_employee.system_role,'branch_id',v_employee.branch_id,'can_manage_settings',v_employee.system_role='manager','permissions',v_permissions,'duty_start_time',v_employee.duty_start_time,'duty_end_time',v_employee.duty_end_time,'meal_break_minutes',v_employee.meal_break_minutes,'monthly_leave_days',v_employee.monthly_leave_days); end; $function$


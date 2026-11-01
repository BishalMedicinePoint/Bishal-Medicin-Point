-- Restrict Purchase creation to linked employees with explicit module permissions.
-- The branch-aware RPC remains the only authenticated entry point.
do $migration$
declare
  v_def text;
  v_old text;
  v_new text;
begin
  v_def := pg_get_functiondef('public.bmp_create_purchase(uuid,numeric,numeric,text,text,text,jsonb,uuid,uuid)'::regprocedure);
  v_old := 'if v_uid is distinct from ''7a3166f2-e4bb-42b8-a649-033dd2d02090''::uuid then raise exception ''Not authorized'';end if;';
  if position(v_old in v_def)=0 then
    raise exception 'Expected authorization check not found; purchase RPC unchanged';
  end if;
  v_new := replace(
    v_def,
    v_old,
    'perform private.bmp_assert_employee_permission(''purchases'',''create'',p_branch_id);' ||
    'perform private.bmp_assert_employee_permission(''suppliers'',''view'',p_branch_id);' ||
    'perform private.bmp_assert_employee_permission(''medicines'',''view'',p_branch_id);' ||
    'if coalesce(p_paid,0)>0 then perform private.bmp_assert_employee_permission(''accounts'',''create'',p_branch_id); end if;'
  );
  execute v_new;
end
$migration$;

revoke all on function public.bmp_create_purchase(uuid,numeric,numeric,text,text,text,jsonb) from public, anon, authenticated;
revoke all on function public.bmp_create_purchase(uuid,numeric,numeric,text,text,text,jsonb,uuid) from public, anon, authenticated;
grant execute on function public.bmp_create_purchase(uuid,numeric,numeric,text,text,text,jsonb,uuid,uuid) to authenticated;

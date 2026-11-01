do $migration$
declare
  v_def text;
  v_new text;
begin
  v_def := pg_get_functiondef('public.bmp_create_sale(uuid,numeric,numeric,text,text,text,jsonb)'::regprocedure);
  v_new := regexp_replace(
    v_def,
    'if v_uid is null or v_uid <> ''7a3166f2-e4bb-42b8-a649-033dd2d02090''::uuid then[[:space:]]+raise exception ''Not authorized'';[[:space:]]+end if;',
    'perform private.bmp_assert_employee_permission(''pos'',''create'',null);',
    'i'
  );
  if v_new = v_def then raise exception 'Could not safely replace 7-argument sale authorization block'; end if;
  execute v_new;

  v_def := pg_get_functiondef('public.bmp_create_sale(uuid,numeric,numeric,text,text,text,jsonb,uuid,uuid)'::regprocedure);
  v_new := regexp_replace(
    v_def,
    'if auth.uid\(\) is distinct from ''7a3166f2-e4bb-42b8-a649-033dd2d02090''::uuid then raise exception ''Not authorized''; end if;',
    'perform private.bmp_assert_employee_permission(''pos'',''create'',p_branch_id);',
    'i'
  );
  if v_new = v_def then raise exception 'Could not safely replace branch-aware sale authorization block'; end if;
  execute v_new;
end
$migration$;

revoke all on function public.bmp_create_sale(uuid,numeric,numeric,text,text,text,jsonb) from public, anon, authenticated;
revoke all on function public.bmp_create_sale(uuid,numeric,numeric,text,text,text,jsonb,uuid) from public, anon, authenticated;
revoke all on function public.bmp_create_sale(uuid,numeric,numeric,text,text,text,jsonb,uuid,uuid) from public, anon, authenticated;
grant execute on function public.bmp_create_sale(uuid,numeric,numeric,text,text,text,jsonb,uuid,uuid) to authenticated;

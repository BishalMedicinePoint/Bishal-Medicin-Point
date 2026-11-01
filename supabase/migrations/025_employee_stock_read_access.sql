drop policy if exists bmp_employee_view_stock_medicines on public.erp_medicines;
create policy bmp_employee_view_stock_medicines
on public.erp_medicines
for select
to authenticated
using (public.bmp_has_employee_permission('stock','view'));

drop policy if exists bmp_employee_view_stock_batches on public.erp_medicine_batches;
create policy bmp_employee_view_stock_batches
on public.erp_medicine_batches
for select
to authenticated
using (
  public.bmp_has_employee_permission('stock','view')
  and private.bmp_employee_has_branch_access(branch_id)
);

drop policy if exists bmp_employee_view_stock_movements on public.erp_stock_movements;
create policy bmp_employee_view_stock_movements
on public.erp_stock_movements
for select
to authenticated
using (
  public.bmp_has_employee_permission('stock','view')
  and private.bmp_employee_has_branch_access(branch_id)
);

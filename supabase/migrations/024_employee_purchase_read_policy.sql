-- Employee Purchase workspace: branch-scoped purchase history only.
drop policy if exists bmp_employee_view_purchase_invoices_branch on public.erp_purchase_invoices;
create policy bmp_employee_view_purchase_invoices_branch
on public.erp_purchase_invoices
for select
to authenticated
using (
  private.bmp_employee_has_branch_access(branch_id)
  and public.bmp_has_employee_permission('purchases','view')
  and exists (
    select 1 from public.erp_suppliers s
    where s.id = erp_purchase_invoices.supplier_id
      and public.bmp_has_employee_permission('suppliers','view')
  )
);

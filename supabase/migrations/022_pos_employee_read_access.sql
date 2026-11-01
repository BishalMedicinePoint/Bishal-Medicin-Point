create policy bmp_employee_view_own_branch
on public.erp_branches for select to authenticated
using (private.bmp_employee_has_branch_access(id));

create policy bmp_employee_view_customers_for_pos
on public.customers for select to authenticated
using (is_active = true and public.bmp_has_employee_permission('customers','view'));

create policy bmp_employee_view_active_accounts
on public.erp_accounts for select to authenticated
using (is_active = true and public.bmp_has_employee_permission('accounts','view'));

create policy bmp_employee_view_branch_sales_invoices
on public.erp_sales_invoices for select to authenticated
using (public.bmp_has_employee_permission('pos','view') and private.bmp_employee_has_branch_access(branch_id));

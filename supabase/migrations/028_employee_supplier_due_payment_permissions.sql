-- 028: Employee Supplier Due & Payment workspace
-- Employees can read supplier dues and payment history only for their linked branch.
-- Payment writes are restricted to the guarded RPC.

drop policy if exists bmp_employee_view_supplier_due_purchases on public.erp_purchase_invoices;
create policy bmp_employee_view_supplier_due_purchases
on public.erp_purchase_invoices for select to authenticated
using (
  private.bmp_employee_has_branch_access(branch_id)
  and public.bmp_has_employee_permission('supplier_due','view')
);

drop policy if exists bmp_employee_view_suppliers_for_due on public.erp_suppliers;
create policy bmp_employee_view_suppliers_for_due
on public.erp_suppliers for select to authenticated
using (
  public.bmp_has_employee_permission('supplier_due','view')
  and exists (
    select 1 from public.erp_purchase_invoices pi
    where pi.supplier_id = erp_suppliers.id
      and private.bmp_employee_has_branch_access(pi.branch_id)
  )
);

drop policy if exists bmp_employee_view_supplier_payments_for_due on public.erp_supplier_payments;
create policy bmp_employee_view_supplier_payments_for_due
on public.erp_supplier_payments for select to authenticated
using (
  public.bmp_has_employee_permission('supplier_due','view')
  and exists (
    select 1 from public.erp_purchase_invoices pi
    where pi.id = erp_supplier_payments.purchase_id
      and private.bmp_employee_has_branch_access(pi.branch_id)
  )
);

create or replace function public.bmp_record_supplier_payment(
  p_purchase_id uuid,
  p_amount numeric,
  p_payment_method text,
  p_reference text,
  p_note text,
  p_account_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_purchase public.erp_purchase_invoices%rowtype;
  v_account public.erp_accounts%rowtype;
  v_payment_id uuid;
  v_paid numeric(12,2);
  v_due numeric(12,2);
  v_amount numeric(12,2);
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;

  select * into v_purchase
  from public.erp_purchase_invoices
  where id = p_purchase_id
  for update;

  if not found or v_purchase.status <> 'received' then
    raise exception 'Purchase invoice not found or not payable';
  end if;

  perform private.bmp_assert_employee_permission('supplier_due','create',v_purchase.branch_id);
  perform private.bmp_assert_employee_permission('accounts','view',v_purchase.branch_id);
  perform private.bmp_assert_employee_permission('accounts','create',v_purchase.branch_id);

  if p_amount is null or p_amount <= 0 then raise exception 'Payment amount must be greater than zero'; end if;
  if p_payment_method not in ('cash','bank','mobile_banking','card','other') then raise exception 'Invalid payment method'; end if;
  if p_account_id is null then raise exception 'Select the account paying this supplier'; end if;

  select * into v_account
  from public.erp_accounts
  where id = p_account_id and is_active
  for update;
  if not found then raise exception 'Selected account is unavailable'; end if;

  if v_purchase.due <= 0 then raise exception 'Purchase has no outstanding due'; end if;
  v_amount := round(p_amount,2);
  if v_amount > v_purchase.due then raise exception 'Payment exceeds outstanding due'; end if;

  v_paid := v_purchase.paid + v_amount;
  v_due := greatest(v_purchase.total - v_paid,0);

  insert into public.erp_supplier_payments(
    supplier_id,purchase_id,amount,payment_method,reference_number,note,created_by,account_id
  ) values (
    v_purchase.supplier_id,v_purchase.id,v_amount,p_payment_method,
    nullif(btrim(p_reference),''),nullif(btrim(p_note),''),auth.uid(),p_account_id
  ) returning id into v_payment_id;

  update public.erp_purchase_invoices
  set paid = v_paid, due = v_due
  where id = v_purchase.id;

  insert into public.erp_supplier_ledger(
    supplier_id,entry_type,amount,purchase_id,note,created_by
  ) values (
    v_purchase.supplier_id,'payment',v_amount,v_purchase.id,
    'Supplier payment '||v_payment_id::text,auth.uid()
  );

  insert into public.erp_account_transactions(
    account_id,transaction_date,transaction_type,category,amount,reference_number,description,created_by
  ) values (
    p_account_id,current_date,'expense','Supplier Payment',v_amount,
    coalesce(nullif(btrim(p_reference),''),v_payment_id::text),
    'Payment for purchase '||v_purchase.purchase_number,auth.uid()
  );

  return jsonb_build_object(
    'payment_id',v_payment_id,'purchase_number',v_purchase.purchase_number,
    'paid',v_paid,'due',v_due,'account_id',p_account_id
  );
end;
$function$;

revoke all on function public.bmp_record_supplier_payment(uuid,numeric,text,text,text) from public, anon, authenticated;
revoke all on function public.bmp_record_supplier_payment(uuid,numeric,text,text,text,uuid) from public, anon, authenticated;
grant execute on function public.bmp_record_supplier_payment(uuid,numeric,text,text,text,uuid) to authenticated;

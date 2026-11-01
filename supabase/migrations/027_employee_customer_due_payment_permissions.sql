-- 027: Employee Customer Due & Payment workspace
-- Read access is branch-scoped and permission-gated; all payment writes remain RPC-only.

drop policy if exists bmp_employee_view_customer_due_invoices on public.erp_sales_invoices;
create policy bmp_employee_view_customer_due_invoices
on public.erp_sales_invoices for select to authenticated
using (
  private.bmp_employee_has_branch_access(branch_id)
  and public.bmp_has_employee_permission('customer_due','view')
);

drop policy if exists bmp_employee_view_customers_for_due on public.customers;
create policy bmp_employee_view_customers_for_due
on public.customers for select to authenticated
using (
  is_active = true
  and public.bmp_has_employee_permission('customer_due','view')
  and exists (
    select 1 from public.erp_sales_invoices si
    where si.customer_id = customers.id
      and private.bmp_employee_has_branch_access(si.branch_id)
  )
);

drop policy if exists bmp_employee_view_customer_payments_for_due on public.erp_customer_payments;
create policy bmp_employee_view_customer_payments_for_due
on public.erp_customer_payments for select to authenticated
using (
  public.bmp_has_employee_permission('customer_due','view')
  and exists (
    select 1 from public.erp_sales_invoices si
    where si.id = erp_customer_payments.invoice_id
      and si.branch_id is not null
      and private.bmp_employee_has_branch_access(si.branch_id)
  )
);

create or replace function public.bmp_record_customer_payment(
  p_invoice_id uuid,
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
  v_invoice public.erp_sales_invoices%rowtype;
  v_account public.erp_accounts%rowtype;
  v_payment_id uuid;
  v_paid numeric(12,2);
  v_due numeric(12,2);
  v_amount numeric(12,2);
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into v_invoice
  from public.erp_sales_invoices
  where id = p_invoice_id
  for update;

  if not found or v_invoice.customer_id is null then
    raise exception 'Customer invoice not found';
  end if;

  perform private.bmp_assert_employee_permission('customer_due','create',v_invoice.branch_id);
  perform private.bmp_assert_employee_permission('accounts','view',v_invoice.branch_id);
  perform private.bmp_assert_employee_permission('accounts','create',v_invoice.branch_id);

  if p_amount is null or p_amount <= 0 then raise exception 'Payment amount must be greater than zero'; end if;
  if p_payment_method not in ('cash','bank','mobile_banking','card','other') then raise exception 'Invalid payment method'; end if;
  if p_account_id is null then raise exception 'Select the account receiving this payment'; end if;

  select * into v_account
  from public.erp_accounts
  where id = p_account_id and is_active
  for update;
  if not found then raise exception 'Selected account is unavailable'; end if;

  if v_invoice.due <= 0 then raise exception 'Invoice has no outstanding due'; end if;
  v_amount := round(p_amount,2);
  if v_amount > v_invoice.due then raise exception 'Payment exceeds invoice due'; end if;

  v_paid := v_invoice.paid + v_amount;
  v_due := greatest(v_invoice.total - v_paid,0);

  update public.erp_sales_invoices
  set paid = v_paid, due = v_due
  where id = v_invoice.id;

  insert into public.erp_customer_payments(
    customer_id,invoice_id,amount,payment_method,reference_number,note,created_by,account_id
  ) values (
    v_invoice.customer_id,v_invoice.id,v_amount,p_payment_method,
    nullif(btrim(p_reference),''),nullif(btrim(p_note),''),auth.uid(),p_account_id
  ) returning id into v_payment_id;

  insert into public.customer_ledger(customer_id,entry_type,amount,note,created_by)
  values (
    v_invoice.customer_id,'collection',v_amount,
    'Due collection for invoice '||v_invoice.invoice_number||' (payment '||v_payment_id::text||')',
    auth.uid()
  );

  insert into public.erp_account_transactions(
    account_id,transaction_date,transaction_type,category,amount,reference_number,description,created_by
  ) values (
    p_account_id,current_date,'income','Customer Due Collection',v_amount,
    coalesce(nullif(btrim(p_reference),''),v_payment_id::text),
    'Customer payment for invoice '||v_invoice.invoice_number,auth.uid()
  );

  return jsonb_build_object(
    'payment_id',v_payment_id,'invoice_number',v_invoice.invoice_number,
    'paid',v_paid,'due',v_due,'account_id',p_account_id
  );
end;
$function$;

revoke all on function public.bmp_record_customer_payment(uuid,numeric,text,text,text) from public, anon, authenticated;
revoke all on function public.bmp_record_customer_payment(uuid,numeric,text,text,text,uuid) from public, anon, authenticated;
grant execute on function public.bmp_record_customer_payment(uuid,numeric,text,text,text,uuid) to authenticated;

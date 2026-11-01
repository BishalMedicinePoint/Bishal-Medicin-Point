
drop policy if exists bmp_employee_view_sales_invoice_items_for_returns on public.erp_sales_invoice_items;
create policy bmp_employee_view_sales_invoice_items_for_returns on public.erp_sales_invoice_items for select to authenticated using (exists(select 1 from public.erp_sales_invoices i where i.id=erp_sales_invoice_items.invoice_id and private.bmp_employee_has_branch_access(i.branch_id) and public.bmp_has_employee_permission('sales_returns','view')));
drop policy if exists bmp_employee_view_sales_invoices_for_returns on public.erp_sales_invoices;
create policy bmp_employee_view_sales_invoices_for_returns on public.erp_sales_invoices for select to authenticated using (private.bmp_employee_has_branch_access(branch_id) and public.bmp_has_employee_permission('sales_returns','view'));
drop policy if exists bmp_employee_view_sales_returns_branch on public.erp_sales_returns;
create policy bmp_employee_view_sales_returns_branch on public.erp_sales_returns for select to authenticated using (exists(select 1 from public.erp_sales_invoices i where i.id=erp_sales_returns.invoice_id and private.bmp_employee_has_branch_access(i.branch_id) and public.bmp_has_employee_permission('sales_returns','view')));
drop policy if exists bmp_employee_view_sales_return_items_branch on public.erp_sales_return_items;
create policy bmp_employee_view_sales_return_items_branch on public.erp_sales_return_items for select to authenticated using (exists(select 1 from public.erp_sales_returns r join public.erp_sales_invoices i on i.id=r.invoice_id where r.id=erp_sales_return_items.return_id and private.bmp_employee_has_branch_access(i.branch_id) and public.bmp_has_employee_permission('sales_returns','view')));
drop policy if exists bmp_employee_view_purchase_invoices_for_returns on public.erp_purchase_invoices;
create policy bmp_employee_view_purchase_invoices_for_returns on public.erp_purchase_invoices for select to authenticated using (private.bmp_employee_has_branch_access(branch_id) and public.bmp_has_employee_permission('purchase_returns','view') and public.bmp_has_employee_permission('suppliers','view'));
drop policy if exists bmp_employee_view_purchase_invoice_items_for_returns on public.erp_purchase_invoice_items;
create policy bmp_employee_view_purchase_invoice_items_for_returns on public.erp_purchase_invoice_items for select to authenticated using (exists(select 1 from public.erp_purchase_invoices p where p.id=erp_purchase_invoice_items.purchase_id and private.bmp_employee_has_branch_access(p.branch_id) and public.bmp_has_employee_permission('purchase_returns','view') and public.bmp_has_employee_permission('suppliers','view')));
drop policy if exists bmp_employee_view_purchase_returns_branch on public.erp_purchase_returns;
create policy bmp_employee_view_purchase_returns_branch on public.erp_purchase_returns for select to authenticated using (exists(select 1 from public.erp_purchase_invoices p where p.id=erp_purchase_returns.purchase_id and private.bmp_employee_has_branch_access(p.branch_id) and public.bmp_has_employee_permission('purchase_returns','view') and public.bmp_has_employee_permission('suppliers','view')));
drop policy if exists bmp_employee_view_purchase_return_items_branch on public.erp_purchase_return_items;
create policy bmp_employee_view_purchase_return_items_branch on public.erp_purchase_return_items for select to authenticated using (exists(select 1 from public.erp_purchase_returns r join public.erp_purchase_invoices p on p.id=r.purchase_id where r.id=erp_purchase_return_items.return_id and private.bmp_employee_has_branch_access(p.branch_id) and public.bmp_has_employee_permission('purchase_returns','view') and public.bmp_has_employee_permission('suppliers','view')));
drop policy if exists bmp_employee_view_purchase_return_batches on public.erp_medicine_batches;
create policy bmp_employee_view_purchase_return_batches on public.erp_medicine_batches for select to authenticated using (private.bmp_employee_has_branch_access(branch_id) and public.bmp_has_employee_permission('purchase_returns','view'));

CREATE OR REPLACE FUNCTION public.bmp_create_purchase_return(p_purchase_item_id uuid, p_quantity integer, p_reason text, p_refund_account_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 v_item public.erp_purchase_invoice_items%rowtype; v_purchase public.erp_purchase_invoices%rowtype;
 v_batch public.erp_medicine_batches%rowtype; v_account public.erp_accounts%rowtype;
 v_returned integer; v_gross_return numeric(12,2); v_discount_share numeric(12,2); v_net_return numeric(12,2);
 v_refund numeric(12,2); v_return_id uuid; v_no text; v_new_subtotal numeric(12,2);
 v_new_discount numeric(12,2); v_new_total numeric(12,2); v_new_due numeric(12,2); v_new_paid numeric(12,2); v_tx uuid;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if p_quantity is null or p_quantity<=0 or nullif(btrim(p_reason),'') is null then raise exception 'Invalid return details'; end if;
 select * into v_item from public.erp_purchase_invoice_items where id=p_purchase_item_id for update;
 if not found then raise exception 'Purchase item not found'; end if;
 select * into v_purchase from public.erp_purchase_invoices where id=v_item.purchase_id for update;
 if not found then raise exception 'Purchase invoice not found'; end if;
 perform private.bmp_assert_employee_permission('purchase_returns','create',v_purchase.branch_id);
 perform private.bmp_assert_employee_permission('suppliers','view',v_purchase.branch_id);
 select * into v_batch from public.erp_medicine_batches where id=v_item.batch_id for update;
 if not found or v_batch.branch_id is distinct from v_purchase.branch_id then raise exception 'Purchase item batch does not belong to invoice branch'; end if;
 select coalesce(sum(quantity),0)::integer into v_returned from public.erp_purchase_return_items where purchase_item_id=v_item.id;
 if p_quantity>v_item.quantity-v_returned then raise exception 'Return quantity exceeds purchased quantity remaining'; end if;
 v_gross_return:=round(v_item.purchase_price*p_quantity,2);
 if v_purchase.subtotal<=0 then raise exception 'Purchase subtotal is invalid'; end if;
 v_discount_share:=least(v_purchase.discount,round(v_purchase.discount*(v_gross_return/v_purchase.subtotal),2));
 v_net_return:=v_gross_return-v_discount_share;
 v_new_subtotal:=greatest(v_purchase.subtotal-v_gross_return,0); v_new_discount:=greatest(v_purchase.discount-v_discount_share,0);
 v_new_total:=greatest(v_new_subtotal-v_new_discount,0); v_refund:=greatest(v_purchase.paid-v_new_total,0);
 v_new_paid:=least(v_purchase.paid,v_new_total); v_new_due:=greatest(v_new_total-v_new_paid,0);
 if v_refund>0 then
  perform private.bmp_assert_employee_permission('accounts','view',null);
  perform private.bmp_assert_employee_permission('accounts','create',null);
  if p_refund_account_id is null then raise exception 'Supplier refund is due; select the account receiving the refund'; end if;
  select * into v_account from public.erp_accounts where id=p_refund_account_id and is_active for update;
  if not found then raise exception 'Selected refund account is unavailable'; end if;
 elsif p_refund_account_id is not null then raise exception 'Refund account should only be selected when supplier refund is due'; end if;
 v_return_id:=gen_random_uuid(); v_no:='BMP-PR-'||to_char(current_date,'YYYY')||'-'||lpad(nextval('public.bmp_purchase_return_seq')::text,6,'0');
 insert into public.erp_purchase_returns(id,return_number,purchase_id,supplier_id,return_total,reason,created_by,supplier_refund_amount,refund_account_id)
 values(v_return_id,v_no,v_purchase.id,v_purchase.supplier_id,v_net_return,btrim(p_reason),auth.uid(),v_refund,case when v_refund>0 then p_refund_account_id else null end);
 insert into public.erp_purchase_return_items(return_id,purchase_item_id,batch_id,medicine_id,quantity,purchase_price,line_total)
 values(v_return_id,v_item.id,v_item.batch_id,v_item.medicine_id,p_quantity,v_item.purchase_price,v_net_return);
 update public.erp_medicine_batches set quantity_available=quantity_available-p_quantity,updated_at=now() where id=v_item.batch_id;
 update public.erp_purchase_invoices set subtotal=v_new_subtotal,discount=v_new_discount,total=v_new_total,paid=v_new_paid,due=v_new_due where id=v_purchase.id;
 insert into public.erp_stock_movements(batch_id,medicine_id,movement_type,quantity_change,reference_type,reference_id,note,created_by,branch_id)
 values(v_item.batch_id,v_item.medicine_id,'adjustment',-p_quantity,'purchase_return',v_return_id,'Purchase return '||v_no,auth.uid(),v_purchase.branch_id);
 insert into public.erp_supplier_ledger(supplier_id,entry_type,amount,purchase_id,note,created_by)
 values(v_purchase.supplier_id,'adjustment',v_net_return,v_purchase.id,'Purchase return '||v_no,auth.uid());
 if v_refund>0 then
  insert into public.erp_account_transactions(account_id,transaction_date,transaction_type,category,amount,reference_number,description,created_by)
  values(p_refund_account_id,current_date,'income','Supplier Purchase Return Refund',v_refund,v_no,'Supplier refund for purchase return',auth.uid()) returning id into v_tx;
  update public.erp_purchase_returns set account_transaction_id=v_tx where id=v_return_id;
 end if;
 return jsonb_build_object('return_id',v_return_id,'return_number',v_no,'gross_return',v_gross_return,'discount_share',v_discount_share,'return_total',v_net_return,'supplier_refund',v_refund,'purchase_due',v_new_due,'purchase_paid',v_new_paid,'branch_id',v_purchase.branch_id);
end;$function$


CREATE OR REPLACE FUNCTION public.bmp_create_sales_return(p_invoice_item_id uuid, p_quantity integer, p_condition text, p_refund_amount numeric, p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 v_item public.erp_sales_invoice_items%rowtype;
 v_invoice public.erp_sales_invoices%rowtype;
 v_batch public.erp_medicine_batches%rowtype;
 v_return_id uuid; v_return_no text; v_return_total numeric(12,2);
 v_previously_returned integer; v_new_total numeric(12,2); v_new_paid numeric(12,2); v_new_due numeric(12,2);
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if p_quantity is null or p_quantity<=0 then raise exception 'Return quantity must be positive'; end if;
 if p_condition not in ('saleable','damaged') then raise exception 'Invalid returned item condition'; end if;
 if nullif(btrim(p_reason),'') is null then raise exception 'Return reason is required'; end if;
 select * into v_item from public.erp_sales_invoice_items where id=p_invoice_item_id for update;
 if not found then raise exception 'Invoice item not found'; end if;
 select * into v_invoice from public.erp_sales_invoices where id=v_item.invoice_id for update;
 if not found then raise exception 'Sales invoice not found'; end if;
 perform private.bmp_assert_employee_permission('sales_returns','create',v_invoice.branch_id);
 select * into v_batch from public.erp_medicine_batches where id=v_item.batch_id for update;
 if not found or v_batch.branch_id is distinct from v_invoice.branch_id then raise exception 'Sales item batch does not belong to invoice branch'; end if;
 select coalesce(sum(ri.quantity),0)::integer into v_previously_returned from public.erp_sales_return_items ri where ri.invoice_item_id=v_item.id;
 if p_quantity>v_item.quantity-v_previously_returned then raise exception 'Return quantity exceeds sold quantity remaining'; end if;
 v_return_total:=round(v_item.unit_price*p_quantity,2);
 if p_refund_amount is null or p_refund_amount<0 or p_refund_amount>v_return_total then raise exception 'Invalid refund amount'; end if;
 if p_refund_amount>v_invoice.paid then raise exception 'Refund cannot exceed amount already paid on invoice'; end if;
 v_return_id:=gen_random_uuid();
 if p_condition='saleable' then
  update public.erp_medicine_batches set quantity_available=quantity_available+p_quantity,updated_at=now() where id=v_item.batch_id;
  insert into public.erp_stock_movements(batch_id,medicine_id,movement_type,quantity_change,reference_type,reference_id,note,created_by,branch_id)
  values(v_item.batch_id,v_item.medicine_id,'sale_return',p_quantity,'sales_return',v_return_id,'Saleable return from invoice '||v_invoice.invoice_number,auth.uid(),v_invoice.branch_id);
 end if;
 v_new_total:=greatest(v_invoice.total-v_return_total,0); v_new_paid:=v_invoice.paid-p_refund_amount; v_new_due:=greatest(v_new_total-v_new_paid,0);
 update public.erp_sales_invoices set total=v_new_total,paid=v_new_paid,due=v_new_due where id=v_invoice.id;
 v_return_no:='BMP-SR-'||to_char(current_date,'YYYY')||'-'||lpad(nextval('public.bmp_sales_return_seq')::text,6,'0');
 insert into public.erp_sales_returns(id,return_number,invoice_id,customer_id,return_total,refund_amount,reason,created_by)
 values(v_return_id,v_return_no,v_invoice.id,v_invoice.customer_id,v_return_total,p_refund_amount,btrim(p_reason),auth.uid());
 insert into public.erp_sales_return_items(return_id,invoice_item_id,medicine_id,batch_id,quantity,unit_price,line_total,condition)
 values(v_return_id,v_item.id,v_item.medicine_id,v_item.batch_id,p_quantity,v_item.unit_price,v_return_total,p_condition);
 if v_invoice.customer_id is not null then
  insert into public.customer_ledger(customer_id,entry_type,amount,note,created_by)
  values(v_invoice.customer_id,'sales_return',v_return_total,'Sales return '||v_return_no||' for invoice '||v_invoice.invoice_number,auth.uid());
 end if;
 return jsonb_build_object('return_id',v_return_id,'return_number',v_return_no,'return_total',v_return_total,'refund_amount',p_refund_amount,'invoice_due',v_new_due,'condition',p_condition,'branch_id',v_invoice.branch_id);
end;$function$


CREATE OR REPLACE FUNCTION public.bmp_create_sales_return(p_invoice_item_id uuid, p_quantity integer, p_condition text, p_refund_amount numeric, p_reason text, p_account_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 v_result jsonb;
 v_account public.erp_accounts%rowtype;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if coalesce(p_refund_amount,0)>0 then
   perform private.bmp_assert_employee_permission('accounts','view',null);
   perform private.bmp_assert_employee_permission('accounts','create',null);
   if p_account_id is null then raise exception 'Select the account paying the refund'; end if;
   select * into v_account from public.erp_accounts where id=p_account_id and is_active for update;
   if not found then raise exception 'Selected account is unavailable'; end if;
 elsif p_account_id is not null then
   raise exception 'Refund account should only be selected when refund amount is zero only if no account was selected';
 end if;

 v_result:=public.bmp_create_sales_return(p_invoice_item_id,p_quantity,p_condition,p_refund_amount,p_reason);

 if coalesce(p_refund_amount,0)>0 then
   insert into public.erp_account_transactions(account_id,transaction_date,transaction_type,category,amount,reference_number,description,created_by)
   values(p_account_id,current_date,'expense','Sales Return Refund',round(p_refund_amount,2),
     v_result->>'return_number','Refund for sales return '||(v_result->>'return_number'),auth.uid());
 end if;
 return v_result||jsonb_build_object('account_id',p_account_id);
end;
$function$


revoke all on function public.bmp_create_sales_return(uuid,integer,text,numeric,text) from public,anon,authenticated;
revoke all on function public.bmp_create_sales_return(uuid,integer,text,numeric,text,uuid) from public,anon;
grant execute on function public.bmp_create_sales_return(uuid,integer,text,numeric,text,uuid) to authenticated;
revoke all on function public.bmp_create_purchase_return(uuid,integer,text) from public,anon,authenticated;
revoke all on function public.bmp_create_purchase_return(uuid,integer,text,uuid) from public,anon;
grant execute on function public.bmp_create_purchase_return(uuid,integer,text,uuid) to authenticated;

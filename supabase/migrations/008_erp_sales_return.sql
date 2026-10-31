create table public.erp_sales_returns(id uuid primary key default gen_random_uuid(),return_number text not null unique,invoice_id uuid not null references public.erp_sales_invoices(id) on delete restrict,customer_id uuid references public.customers(id) on delete restrict,return_total numeric(12,2) not null check(return_total>0),refund_amount numeric(12,2) not null default 0 check(refund_amount>=0 and refund_amount<=return_total),reason text not null,created_by uuid not null references auth.users(id),created_at timestamptz not null default now());
create sequence public.bmp_sales_return_seq start 1;
create table public.erp_sales_return_items(id uuid primary key default gen_random_uuid(),return_id uuid not null references public.erp_sales_returns(id) on delete restrict,invoice_item_id uuid not null references public.erp_sales_invoice_items(id) on delete restrict,medicine_id uuid not null references public.erp_medicines(id) on delete restrict,batch_id uuid not null references public.erp_medicine_batches(id) on delete restrict,quantity integer not null check(quantity>0),unit_price numeric(12,2) not null check(unit_price>=0),line_total numeric(12,2) not null check(line_total>0),condition text not null check(condition in ('saleable','damaged')),created_at timestamptz not null default now());
alter table public.erp_sales_returns enable row level security; alter table public.erp_sales_return_items enable row level security;
create policy bmp_admin_manage_sales_returns on public.erp_sales_returns for all to authenticated using(auth.uid()='7a3166f2-e4bb-42b8-a649-033dd2d02090'::uuid) with check(auth.uid()='7a3166f2-e4bb-42b8-a649-033dd2d02090'::uuid);
create policy bmp_admin_manage_sales_return_items on public.erp_sales_return_items for all to authenticated using(auth.uid()='7a3166f2-e4bb-42b8-a649-033dd2d02090'::uuid) with check(auth.uid()='7a3166f2-e4bb-42b8-a649-033dd2d02090'::uuid);
grant select,insert on public.erp_sales_returns,public.erp_sales_return_items to authenticated;
create or replace function public.bmp_create_sales_return(p_invoice_item_id uuid,p_quantity integer,p_condition text,p_refund_amount numeric,p_reason text) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_item public.erp_sales_invoice_items%rowtype; v_invoice public.erp_sales_invoices%rowtype; v_return_id uuid; v_return_no text; v_total numeric(12,2); v_returned integer; v_new_total numeric(12,2); v_new_paid numeric(12,2); v_new_due numeric(12,2);
begin
if auth.uid() is distinct from '7a3166f2-e4bb-42b8-a649-033dd2d02090'::uuid then raise exception 'Not authorized'; end if;
if p_quantity is null or p_quantity<=0 or p_condition not in ('saleable','damaged') or nullif(btrim(p_reason),'') is null then raise exception 'Invalid return details'; end if;
select * into v_item from public.erp_sales_invoice_items where id=p_invoice_item_id for update; if not found then raise exception 'Invoice item not found'; end if;
select * into v_invoice from public.erp_sales_invoices where id=v_item.invoice_id for update;
select coalesce(sum(quantity),0)::integer into v_returned from public.erp_sales_return_items where invoice_item_id=v_item.id;
if p_quantity>v_item.quantity-v_returned then raise exception 'Return quantity exceeds sold quantity remaining'; end if;
v_total:=round(v_item.unit_price*p_quantity,2);
if p_refund_amount is null or p_refund_amount<0 or p_refund_amount>v_total or p_refund_amount>v_invoice.paid then raise exception 'Invalid refund amount'; end if;
if p_condition='saleable' then
update public.erp_medicine_batches set quantity_available=quantity_available+p_quantity,quantity_received=quantity_received+p_quantity,updated_at=now() where id=v_item.batch_id;
end if;
v_new_total:=greatest(v_invoice.total-v_total,0); v_new_paid:=v_invoice.paid-p_refund_amount; v_new_due:=greatest(v_new_total-v_new_paid,0);
update public.erp_sales_invoices set total=v_new_total,paid=v_new_paid,due=v_new_due where id=v_invoice.id;
v_return_no:='BMP-SR-'||to_char(current_date,'YYYY')||'-'||lpad(nextval('public.bmp_sales_return_seq')::text,6,'0');
insert into public.erp_sales_returns(return_number,invoice_id,customer_id,return_total,refund_amount,reason,created_by) values(v_return_no,v_invoice.id,v_invoice.customer_id,v_total,p_refund_amount,btrim(p_reason),auth.uid()) returning id into v_return_id;
insert into public.erp_sales_return_items(return_id,invoice_item_id,medicine_id,batch_id,quantity,unit_price,line_total,condition) values(v_return_id,v_item.id,v_item.medicine_id,v_item.batch_id,p_quantity,v_item.unit_price,v_total,p_condition);
if p_condition='saleable' then insert into public.erp_stock_movements(batch_id,medicine_id,movement_type,quantity_change,reference_type,reference_id,note,created_by) values(v_item.batch_id,v_item.medicine_id,'sale_return',p_quantity,'sales_return',v_return_id,'Saleable return from invoice '||v_invoice.invoice_number,auth.uid()); end if;
if v_invoice.customer_id is not null then insert into public.customer_ledger(customer_id,entry_type,amount,note,created_by) values(v_invoice.customer_id,'sales_return',v_total,'Sales return '||v_return_no||' for invoice '||v_invoice.invoice_number,auth.uid()); end if;
return jsonb_build_object('return_id',v_return_id,'return_number',v_return_no,'return_total',v_total,'refund_amount',p_refund_amount,'invoice_due',v_new_due,'condition',p_condition);
end; $$;
revoke all on function public.bmp_create_sales_return(uuid,integer,text,numeric,text) from public; grant execute on function public.bmp_create_sales_return(uuid,integer,text,numeric,text) to authenticated;
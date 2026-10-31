create sequence if not exists public.bmp_invoice_number_seq;
create table if not exists public.erp_sales_invoices (
 id uuid primary key default gen_random_uuid(), invoice_number text not null unique,
 customer_id uuid references public.customers(id) on delete restrict, sale_date timestamptz not null default now(),
 subtotal numeric(14,2) not null check(subtotal>=0), discount numeric(14,2) not null default 0 check(discount>=0),
 total numeric(14,2) not null check(total>=0), paid numeric(14,2) not null default 0 check(paid>=0),
 due numeric(14,2) not null default 0 check(due>=0),
 payment_method text not null default 'cash' check(payment_method in ('cash','bank','mobile_banking','card','other')),
 payment_reference text, notes text, status text not null default 'completed' check(status in ('completed','voided')),
 created_by uuid not null references auth.users(id), created_at timestamptz not null default now(),
 check(paid<=total),check(due=total-paid));
create table if not exists public.erp_sales_invoice_items (
 id uuid primary key default gen_random_uuid(), invoice_id uuid not null references public.erp_sales_invoices(id) on delete restrict,
 medicine_id uuid not null references public.erp_medicines(id) on delete restrict,
 batch_id uuid not null references public.erp_medicine_batches(id) on delete restrict,
 medicine_name text not null,batch_number text not null,quantity integer not null check(quantity>0),
 unit_price numeric(14,2) not null check(unit_price>=0),purchase_price numeric(14,2) not null check(purchase_price>=0),
 line_total numeric(14,2) not null check(line_total>=0),created_at timestamptz not null default now());
create table if not exists public.erp_stock_movements (
 id uuid primary key default gen_random_uuid(),batch_id uuid not null references public.erp_medicine_batches(id) on delete restrict,
 medicine_id uuid not null references public.erp_medicines(id) on delete restrict,
 movement_type text not null check(movement_type in ('sale','sale_return','purchase','adjustment')),
 quantity_change integer not null check(quantity_change<>0),reference_type text not null,reference_id uuid not null,
 note text,created_by uuid not null references auth.users(id),created_at timestamptz not null default now());
create index if not exists erp_sales_invoices_sale_date_idx on public.erp_sales_invoices(sale_date desc);
create index if not exists erp_sales_invoice_items_invoice_idx on public.erp_sales_invoice_items(invoice_id);
create index if not exists erp_stock_movements_batch_idx on public.erp_stock_movements(batch_id,created_at desc);
alter table public.erp_sales_invoices enable row level security;
alter table public.erp_sales_invoice_items enable row level security;
alter table public.erp_stock_movements enable row level security;
drop policy if exists erp_sales_invoices_admin_all on public.erp_sales_invoices;
create policy erp_sales_invoices_admin_all on public.erp_sales_invoices for all to authenticated using ((select auth.uid())='7a3166f2-e4bb-42b8-a649-033dd2d02090'::uuid) with check ((select auth.uid())='7a3166f2-e4bb-42b8-a649-033dd2d02090'::uuid);
drop policy if exists erp_sales_items_admin_all on public.erp_sales_invoice_items;
create policy erp_sales_items_admin_all on public.erp_sales_invoice_items for all to authenticated using ((select auth.uid())='7a3166f2-e4bb-42b8-a649-033dd2d02090'::uuid) with check ((select auth.uid())='7a3166f2-e4bb-42b8-a649-033dd2d02090'::uuid);
drop policy if exists erp_stock_movements_admin_all on public.erp_stock_movements;
create policy erp_stock_movements_admin_all on public.erp_stock_movements for all to authenticated using ((select auth.uid())='7a3166f2-e4bb-42b8-a649-033dd2d02090'::uuid) with check ((select auth.uid())='7a3166f2-e4bb-42b8-a649-033dd2d02090'::uuid);
grant select,insert,update,delete on public.erp_sales_invoices,public.erp_sales_invoice_items,public.erp_stock_movements to authenticated;
grant usage,select on sequence public.bmp_invoice_number_seq to authenticated;
create or replace function public.bmp_create_sale(p_customer_id uuid,p_discount numeric,p_paid numeric,p_payment_method text,p_payment_reference text,p_notes text,p_items jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 v_uid uuid:=auth.uid();v_invoice_id uuid;v_invoice_no text;v_subtotal numeric(14,2):=0;v_total numeric(14,2);v_due numeric(14,2);
 v_item jsonb;v_batch public.erp_medicine_batches%rowtype;v_med public.erp_medicines%rowtype;v_qty integer;v_price numeric(14,2);v_line numeric(14,2);v_customer_id uuid:=p_customer_id;
begin
 if v_uid is null or v_uid<>'7a3166f2-e4bb-42b8-a649-033dd2d02090'::uuid then raise exception 'Not authorized';end if;
 if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)=0 then raise exception 'Cart is empty';end if;
 if coalesce(p_discount,0)<0 or coalesce(p_paid,0)<0 then raise exception 'Discount and payment cannot be negative';end if;
 if p_payment_method not in ('cash','bank','mobile_banking','card','other') then raise exception 'Invalid payment method';end if;
 if v_customer_id is not null and not exists(select 1 from public.customers c where c.id=v_customer_id and c.is_active) then raise exception 'Customer is not active';end if;
 for v_item in select value from jsonb_array_elements(p_items) loop
  v_qty:=(v_item->>'quantity')::integer;v_price:=(v_item->>'unit_price')::numeric;
  if v_qty is null or v_qty<=0 or v_price is null or v_price<0 then raise exception 'Invalid quantity or price';end if;
  select * into v_batch from public.erp_medicine_batches where id=(v_item->>'batch_id')::uuid for update;
  if not found then raise exception 'Batch not found';end if;
  if not v_batch.is_active or v_batch.expiry_date<current_date then raise exception 'Batch is inactive or expired: %',v_batch.batch_number;end if;
  if v_batch.quantity_available<v_qty then raise exception 'Insufficient stock for batch %',v_batch.batch_number;end if;
  select * into v_med from public.erp_medicines where id=v_batch.medicine_id;
  if not found or not v_med.is_active then raise exception 'Medicine is inactive';end if;
  v_subtotal:=v_subtotal+round(v_qty*v_price,2);
 end loop;
 if p_discount>v_subtotal then raise exception 'Discount cannot exceed subtotal';end if;
 v_total:=round(v_subtotal-coalesce(p_discount,0),2);
 if coalesce(p_paid,0)>v_total then raise exception 'Paid amount cannot exceed invoice total';end if;
 v_due:=v_total-coalesce(p_paid,0);
 if v_due>0 and v_customer_id is null then raise exception 'Select a customer for credit sale';end if;
 v_invoice_no:='BMP-'||to_char(current_date,'YYYYMMDD')||'-'||lpad(nextval('public.bmp_invoice_number_seq')::text,6,'0');
 insert into public.erp_sales_invoices(invoice_number,customer_id,subtotal,discount,total,paid,due,payment_method,payment_reference,notes,created_by)
 values(v_invoice_no,v_customer_id,v_subtotal,coalesce(p_discount,0),v_total,coalesce(p_paid,0),v_due,p_payment_method,nullif(btrim(p_payment_reference),''),nullif(btrim(p_notes),''),v_uid) returning id into v_invoice_id;
 for v_item in select value from jsonb_array_elements(p_items) loop
  v_qty:=(v_item->>'quantity')::integer;v_price:=(v_item->>'unit_price')::numeric;
  select * into v_batch from public.erp_medicine_batches where id=(v_item->>'batch_id')::uuid for update;
  select * into v_med from public.erp_medicines where id=v_batch.medicine_id;v_line:=round(v_qty*v_price,2);
  update public.erp_medicine_batches set quantity_available=quantity_available-v_qty,updated_at=now() where id=v_batch.id;
  insert into public.erp_sales_invoice_items(invoice_id,medicine_id,batch_id,medicine_name,batch_number,quantity,unit_price,purchase_price,line_total)
  values(v_invoice_id,v_med.id,v_batch.id,v_med.medicine_name,v_batch.batch_number,v_qty,v_price,v_batch.purchase_price,v_line);
  insert into public.erp_stock_movements(batch_id,medicine_id,movement_type,quantity_change,reference_type,reference_id,note,created_by)
  values(v_batch.id,v_med.id,'sale',-v_qty,'sales_invoice',v_invoice_id,'POS sale '||v_invoice_no,v_uid);
 end loop;
 if v_due>0 then insert into public.customer_ledger(customer_id,entry_type,amount,note,created_by) values(v_customer_id,'sale_due',v_due,'POS invoice '||v_invoice_no,v_uid);end if;
 return jsonb_build_object('invoice_id',v_invoice_id,'invoice_number',v_invoice_no,'subtotal',v_subtotal,'discount',p_discount,'total',v_total,'paid',coalesce(p_paid,0),'due',v_due);
end;$$;
revoke all on function public.bmp_create_sale(uuid,numeric,numeric,text,text,text,jsonb) from public;
grant execute on function public.bmp_create_sale(uuid,numeric,numeric,text,text,text,jsonb) to authenticated;
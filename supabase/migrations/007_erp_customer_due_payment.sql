create table public.erp_customer_payments (
id uuid primary key default gen_random_uuid(),
customer_id uuid not null references public.customers(id) on delete restrict,
invoice_id uuid not null references public.erp_sales_invoices(id) on delete restrict,
amount numeric(12,2) not null check(amount > 0),
payment_method text not null check(payment_method in ('cash','bank','mobile_banking','card','other')),
reference_number text, note text, created_by uuid not null references auth.users(id),
created_at timestamptz not null default now()
);
create index erp_customer_payments_created_idx on public.erp_customer_payments(created_at desc);
create index erp_customer_payments_customer_idx on public.erp_customer_payments(customer_id,created_at desc);
alter table public.erp_customer_payments enable row level security;
create policy bmp_admin_manage_customer_payments on public.erp_customer_payments for all to authenticated
using(auth.uid()='7a3166f2-e4bb-42b8-a649-033dd2d02090'::uuid)
with check(auth.uid()='7a3166f2-e4bb-42b8-a649-033dd2d02090'::uuid);
grant select,insert on public.erp_customer_payments to authenticated;
create or replace function public.bmp_record_customer_payment(p_invoice_id uuid,p_amount numeric,p_payment_method text,p_reference text default null,p_note text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_invoice public.erp_sales_invoices%rowtype; v_payment_id uuid; v_paid numeric(12,2); v_due numeric(12,2);
begin
if auth.uid() is distinct from '7a3166f2-e4bb-42b8-a649-033dd2d02090'::uuid then raise exception 'Not authorized'; end if;
if p_amount is null or p_amount<=0 then raise exception 'Payment amount must be positive'; end if;
if p_payment_method not in ('cash','bank','mobile_banking','card','other') then raise exception 'Invalid payment method'; end if;
select * into v_invoice from public.erp_sales_invoices where id=p_invoice_id for update;
if not found then raise exception 'Invoice not found'; end if;
if v_invoice.customer_id is null or v_invoice.due<=0 then raise exception 'Invoice has no customer due'; end if;
if p_amount>v_invoice.due then raise exception 'Payment exceeds invoice due'; end if;
v_paid:=v_invoice.paid+round(p_amount,2); v_due:=v_invoice.total-v_paid;
update public.erp_sales_invoices set paid=v_paid,due=greatest(v_due,0) where id=v_invoice.id;
insert into public.erp_customer_payments(customer_id,invoice_id,amount,payment_method,reference_number,note,created_by)
values(v_invoice.customer_id,v_invoice.id,round(p_amount,2),p_payment_method,nullif(btrim(p_reference),''),nullif(btrim(p_note),''),auth.uid()) returning id into v_payment_id;
insert into public.customer_ledger(customer_id,entry_type,amount,note,created_by)
values(v_invoice.customer_id,'collection',round(p_amount,2),'Due collection for invoice '||v_invoice.invoice_number||' payment '||v_payment_id::text,auth.uid());
return jsonb_build_object('payment_id',v_payment_id,'invoice_number',v_invoice.invoice_number,'paid',v_paid,'due',greatest(v_due,0));
end; $$;
revoke all on function public.bmp_record_customer_payment(uuid,numeric,text,text,text) from public;
grant execute on function public.bmp_record_customer_payment(uuid,numeric,text,text,text) to authenticated;
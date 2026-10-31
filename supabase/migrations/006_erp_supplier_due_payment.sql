
create table if not exists public.erp_supplier_payments (
 id uuid primary key default gen_random_uuid(),
 supplier_id uuid not null references public.erp_suppliers(id) on delete restrict,
 purchase_id uuid not null references public.erp_purchase_invoices(id) on delete restrict,
 amount numeric(14,2) not null check(amount > 0),
 payment_method text not null default 'cash' check(payment_method in ('cash','bank','mobile_banking','card','other')),
 reference_number text,
 note text,
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now()
);
create index if not exists erp_supplier_payments_supplier_date_idx on public.erp_supplier_payments(supplier_id,created_at desc);
create index if not exists erp_supplier_payments_purchase_idx on public.erp_supplier_payments(purchase_id,created_at desc);
alter table public.erp_supplier_payments enable row level security;
drop policy if exists "erp_supplier_payments_admin_all" on public.erp_supplier_payments;
create policy "erp_supplier_payments_admin_all" on public.erp_supplier_payments for all to authenticated
 using (auth.uid() = '7a3166f2-e4bb-42b8-a649-033dd2d02090'::uuid)
 with check (auth.uid() = '7a3166f2-e4bb-42b8-a649-033dd2d02090'::uuid);
grant select,insert on public.erp_supplier_payments to authenticated;

create or replace function public.bmp_record_supplier_payment(
 p_purchase_id uuid, p_amount numeric, p_payment_method text default 'cash',
 p_reference text default null, p_note text default null
) returns jsonb
language plpgsql security definer set search_path=''
as $$
declare v_user uuid; v_purchase public.erp_purchase_invoices%rowtype; v_payment_id uuid; v_new_paid numeric; v_new_due numeric;
begin
 v_user := auth.uid();
 if v_user is null or v_user <> '7a3166f2-e4bb-42b8-a649-033dd2d02090'::uuid then raise exception 'Not authorized'; end if;
 if p_amount is null or p_amount <= 0 then raise exception 'Payment amount must be greater than zero'; end if;
 if p_payment_method not in ('cash','bank','mobile_banking','card','other') then raise exception 'Invalid payment method'; end if;
 select * into v_purchase from public.erp_purchase_invoices where id=p_purchase_id for update;
 if not found or v_purchase.status <> 'received' then raise exception 'Purchase invoice not found or not payable'; end if;
 if p_amount > v_purchase.due then raise exception 'Payment exceeds outstanding due'; end if;
 v_new_paid := v_purchase.paid + p_amount; v_new_due := v_purchase.due - p_amount;
 insert into public.erp_supplier_payments(supplier_id,purchase_id,amount,payment_method,reference_number,note,created_by)
 values(v_purchase.supplier_id,v_purchase.id,p_amount,p_payment_method,nullif(btrim(p_reference),''),nullif(btrim(p_note),''),v_user)
 returning id into v_payment_id;
 update public.erp_purchase_invoices set paid=v_new_paid,due=v_new_due where id=v_purchase.id;
 insert into public.erp_supplier_ledger(supplier_id,entry_type,amount,purchase_id,note,created_by)
 values(v_purchase.supplier_id,'payment',p_amount,v_purchase.id,'Supplier payment '||v_payment_id,v_user);
 return jsonb_build_object('payment_id',v_payment_id,'purchase_number',v_purchase.purchase_number,'paid',v_new_paid,'due',v_new_due);
end $$;
revoke all on function public.bmp_record_supplier_payment(uuid,numeric,text,text,text) from public;
grant execute on function public.bmp_record_supplier_payment(uuid,numeric,text,text,text) to authenticated;

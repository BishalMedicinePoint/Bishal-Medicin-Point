create table public.erp_accounts (
 id uuid primary key default gen_random_uuid(),
 account_name text not null unique,
 account_type text not null check(account_type in ('cash','bank','mobile_banking','other')),
 opening_balance numeric(14,2) not null default 0 check(opening_balance>=0),
 is_active boolean not null default true,
 notes text,
 created_by uuid not null default auth.uid() references auth.users(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table public.erp_account_transactions (
 id uuid primary key default gen_random_uuid(),
 account_id uuid not null references public.erp_accounts(id) on delete restrict,
 transaction_date date not null default current_date,
 transaction_type text not null check(transaction_type in ('income','expense')),
 category text not null,
 amount numeric(14,2) not null check(amount>0),
 reference_number text,
 description text,
 created_by uuid not null default auth.uid() references auth.users(id),
 created_at timestamptz not null default now()
);
create index erp_account_transactions_date_idx on public.erp_account_transactions(transaction_date desc);
create index erp_account_transactions_account_idx on public.erp_account_transactions(account_id,transaction_date desc);
alter table public.erp_accounts enable row level security;
alter table public.erp_account_transactions enable row level security;
create policy bmp_admin_manage_accounts on public.erp_accounts for all to authenticated using(auth.uid()='7a3166f2-e4bb-42b8-a649-033dd2d02090'::uuid) with check(auth.uid()='7a3166f2-e4bb-42b8-a649-033dd2d02090'::uuid);
create policy bmp_admin_manage_account_transactions on public.erp_account_transactions for all to authenticated using(auth.uid()='7a3166f2-e4bb-42b8-a649-033dd2d02090'::uuid) with check(auth.uid()='7a3166f2-e4bb-42b8-a649-033dd2d02090'::uuid);
grant select,insert,update,delete on public.erp_accounts,public.erp_account_transactions to authenticated;

-- Shopping lists. RLS restricts every user to their own lists.
-- A list is created "open" and can then be marked "completed" or "archived" (one way).

create table public.shopping_lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  supermarket_id uuid not null references public.supermarkets (id) on delete restrict,
  shop_date date not null,
  status text not null default 'open' check (status in ('open', 'completed', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index shopping_lists_user_status_date_idx
  on public.shopping_lists (user_id, status, shop_date);

alter table public.shopping_lists enable row level security;

create policy "Users can view their own lists"
  on public.shopping_lists for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can create their own open lists"
  on public.shopping_lists for insert
  to authenticated
  with check ((select auth.uid()) = user_id and status = 'open');

create policy "Users can update their own lists"
  on public.shopping_lists for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- No delete policy: lists are archived rather than deleted.

-- Only open lists can change status.
create function public.check_shopping_list_status()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status is distinct from old.status and old.status <> 'open' then
    raise exception 'Only open lists can be marked as completed or archived.';
  end if;
  return new;
end;
$$;

create trigger shopping_lists_check_status
  before update on public.shopping_lists
  for each row execute function public.check_shopping_list_status();

create trigger shopping_lists_set_updated_at
  before update on public.shopping_lists
  for each row execute function public.set_updated_at();

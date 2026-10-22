-- Shopping list items, manual list deletion, and automatic deletion of archived lists.

-- ---------------------------------------------------------------------------
-- Every user gets a profile row, so per-user settings always exist.
-- ---------------------------------------------------------------------------

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

insert into public.profiles (id)
select id from auth.users
on conflict (id) do nothing;

-- Days to keep archived lists before they are deleted. Null = keep forever.
alter table public.profiles
  add column archive_retention_days integer default 90
    check (archive_retention_days in (7, 30, 90, 180, 365));

-- ---------------------------------------------------------------------------
-- Lists: record when a list was archived, and allow deleting finished lists.
-- ---------------------------------------------------------------------------

alter table public.shopping_lists add column archived_at timestamptz;

update public.shopping_lists set archived_at = updated_at where status = 'archived';

-- Only open lists can change status; archived_at is set here and can't be edited directly.
create or replace function public.check_shopping_list_status()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status is distinct from old.status and old.status <> 'open' then
    raise exception 'Only open lists can be marked as completed or archived.';
  end if;

  if new.status = 'archived' and old.status = 'open' then
    new.archived_at = now();
  else
    new.archived_at = old.archived_at;
  end if;

  return new;
end;
$$;

create policy "Users can delete their own finished lists"
  on public.shopping_lists for delete
  to authenticated
  using ((select auth.uid()) = user_id and status in ('completed', 'archived'));

-- ---------------------------------------------------------------------------
-- Items. One row per item; AI suggestions can later reference items by id.
-- ---------------------------------------------------------------------------

create table public.shopping_list_items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.shopping_lists (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  quantity numeric check (quantity > 0),
  unit text check (char_length(unit) <= 20),
  notes text check (char_length(notes) <= 500),
  position integer not null default 0,
  is_checked boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index shopping_list_items_list_position_idx
  on public.shopping_list_items (list_id, position);

alter table public.shopping_list_items enable row level security;

create policy "Users can view their own items"
  on public.shopping_list_items for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can add items to their own lists"
  on public.shopping_list_items for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.shopping_lists l
      where l.id = list_id and l.user_id = (select auth.uid())
    )
  );

create policy "Users can update their own items"
  on public.shopping_list_items for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.shopping_lists l
      where l.id = list_id and l.user_id = (select auth.uid())
    )
  );

create policy "Users can delete their own items"
  on public.shopping_list_items for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- Items can only be changed while their list is open. When a whole list is
-- deleted the list row is already gone, so the cascade is allowed through.
create function public.check_list_item_editable()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  list_status text;
begin
  if tg_op in ('UPDATE', 'DELETE') then
    select status into list_status from public.shopping_lists where id = old.list_id;
    if list_status is not null and list_status <> 'open' then
      raise exception 'Items can only be changed on open lists.';
    end if;
  end if;

  if tg_op in ('INSERT', 'UPDATE') then
    select status into list_status from public.shopping_lists where id = new.list_id;
    if list_status is not null and list_status <> 'open' then
      raise exception 'Items can only be changed on open lists.';
    end if;
    return new;
  end if;

  return old;
end;
$$;

create trigger shopping_list_items_check_editable
  before insert or update or delete on public.shopping_list_items
  for each row execute function public.check_list_item_editable();

create trigger shopping_list_items_set_updated_at
  before update on public.shopping_list_items
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Nightly clean-up: delete archived lists past each user's retention period.
-- Runs as the database owner, so it is not limited by RLS. Items cascade.
-- If enabling pg_cron here fails, enable it under Database → Extensions first.
-- ---------------------------------------------------------------------------

create extension if not exists pg_cron;

select cron.schedule(
  'delete-expired-archived-lists',
  '30 3 * * *',
  $$
    delete from public.shopping_lists l
    using public.profiles p
    where p.id = l.user_id
      and l.status = 'archived'
      and p.archive_retention_days is not null
      and l.archived_at < now() - make_interval(days => p.archive_retention_days);
  $$
);

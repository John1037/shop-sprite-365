-- Supermarkets reference list, and up to six preferred supermarkets per profile.
-- Slot 1 is the user's top preference.

create table public.supermarkets (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(name) <= 100),
  website text check (char_length(website) <= 200),
  logo_url text check (char_length(logo_url) <= 500),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.supermarkets enable row level security;

-- Shared reference data: any signed-in user can read it. There are no write
-- policies, so it can only be changed from the dashboard or with the secret key.
create policy "Signed-in users can view supermarkets"
  on public.supermarkets for select
  to authenticated
  using (true);

-- True when the non-null values in the array are all different.
create function public.uuids_are_distinct(ids uuid[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select count(*) = count(distinct id)
  from unnest(ids) as id
  where id is not null;
$$;

alter table public.profiles
  add column supermarket_1 uuid references public.supermarkets (id) on delete set null,
  add column supermarket_2 uuid references public.supermarkets (id) on delete set null,
  add column supermarket_3 uuid references public.supermarkets (id) on delete set null,
  add column supermarket_4 uuid references public.supermarkets (id) on delete set null,
  add column supermarket_5 uuid references public.supermarkets (id) on delete set null,
  add column supermarket_6 uuid references public.supermarkets (id) on delete set null,
  add constraint profiles_supermarkets_distinct check (
    public.uuids_are_distinct(array[supermarket_1, supermarket_2, supermarket_3,
                                    supermarket_4, supermarket_5, supermarket_6])
  );

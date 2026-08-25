begin;

create table if not exists public.computer_access_accounts (
  id uuid primary key default extensions.gen_random_uuid(),
  league_id uuid not null,
  player_id text not null,
  username text not null,
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  auth_email text not null,
  enabled boolean not null default true,
  failed_attempts integer not null default 0,
  locked_until timestamptz,
  last_failed_at timestamptz,
  last_success_at timestamptz,
  last_pin_reset_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint computer_access_accounts_player_fk
    foreign key (league_id, player_id)
    references public.league_players(league_id, player_id)
    on delete cascade,
  constraint computer_access_accounts_username_normalized_check
    check (username = lower(btrim(username))),
  constraint computer_access_accounts_username_length_check
    check (char_length(username) between 2 and 40),
  constraint computer_access_accounts_email_normalized_check
    check (auth_email = lower(btrim(auth_email))),
  constraint computer_access_accounts_failed_attempts_check
    check (failed_attempts >= 0)
);

create unique index if not exists computer_access_accounts_one_per_player
  on public.computer_access_accounts (league_id, player_id);

create unique index if not exists computer_access_accounts_unique_username
  on public.computer_access_accounts (username);

create unique index if not exists computer_access_accounts_unique_auth_user
  on public.computer_access_accounts (auth_user_id);

alter table public.computer_access_accounts enable row level security;

revoke all on table public.computer_access_accounts from public, anon, authenticated;
grant select, insert, update, delete on table public.computer_access_accounts to service_role;

comment on table public.computer_access_accounts is
  'Server-managed username/PIN computer-access metadata. PIN values are never stored here; Supabase Auth stores only the derived password hash.';

create or replace function public.cloud_connection_status()
returns table (
  schema_version integer,
  service text,
  checked_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    12 as schema_version,
    'head2head-brawlin'::text as service,
    now() as checked_at
$$;

revoke all on function public.cloud_connection_status()
  from public;

grant execute on function public.cloud_connection_status()
  to anon, authenticated;

notify pgrst, 'reload schema';

commit;

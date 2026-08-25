-- Head2Head Brawlin'
-- Cloud-authoritative payout/payment ledger
--
-- One row per league + season.
-- The existing payout engine remains unchanged; this table replaces
-- browser-only localStorage as the authoritative persistence layer.

create table if not exists public.payout_ledger_seasons (
  league_id uuid not null
    references public.leagues(id)
    on delete cascade,

  season integer not null
    check (season >= 2020 and season <= 2100),

  ledger jsonb not null
    default '{}'::jsonb,

  schema_version integer not null
    default 1,

  updated_by uuid
    default auth.uid(),

  created_at timestamptz not null
    default now(),

  updated_at timestamptz not null
    default now(),

  primary key (league_id, season)
);

alter table public.payout_ledger_seasons
  enable row level security;

drop policy if exists
  payout_ledger_seasons_select_commissioners
  on public.payout_ledger_seasons;

create policy
  payout_ledger_seasons_select_commissioners
on public.payout_ledger_seasons
for select
to authenticated
using (
  public.current_league_role(league_id)
    in ('commissioner', 'backup_commissioner')
);

drop policy if exists
  payout_ledger_seasons_insert_commissioners
  on public.payout_ledger_seasons;

create policy
  payout_ledger_seasons_insert_commissioners
on public.payout_ledger_seasons
for insert
to authenticated
with check (
  public.current_league_role(league_id)
    in ('commissioner', 'backup_commissioner')
);

drop policy if exists
  payout_ledger_seasons_update_commissioners
  on public.payout_ledger_seasons;

create policy
  payout_ledger_seasons_update_commissioners
on public.payout_ledger_seasons
for update
to authenticated
using (
  public.current_league_role(league_id)
    in ('commissioner', 'backup_commissioner')
)
with check (
  public.current_league_role(league_id)
    in ('commissioner', 'backup_commissioner')
);

revoke all
on table public.payout_ledger_seasons
from public, anon;

grant select, insert, update
on table public.payout_ledger_seasons
to authenticated;

comment on table public.payout_ledger_seasons is
  'Cloud-authoritative Head2Head payout/payment ledger. Commissioner and backup commissioner access only.';
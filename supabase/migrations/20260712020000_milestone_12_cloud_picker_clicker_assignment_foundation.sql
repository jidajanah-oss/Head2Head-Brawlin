begin;

-- One immutable, cloud-authoritative Picker Clicker source assignment per
-- league, season, and week. Display name and NFL team are roster snapshots
-- captured by the database when the assignment is created.
create table public.picker_clicker_week_assignments (
  league_id uuid not null
    references public.leagues(id)
    on delete cascade,
  season integer not null,
  week smallint not null,
  source_player_id text not null,
  source_player_name text not null,
  source_nfl_team text not null,
  cycle_number integer not null,
  assigned_at timestamptz not null default now(),
  created_by uuid not null default auth.uid()
    references auth.users(id)
    on delete restrict,
  created_at timestamptz not null default now(),
  primary key (league_id, season, week),
  constraint picker_clicker_week_assignments_source_player_fk
    foreign key (league_id, source_player_id)
    references public.league_players(league_id, player_id)
    on delete restrict,
  constraint picker_clicker_week_assignments_season_check
    check (season between 2000 and 2100),
  constraint picker_clicker_week_assignments_week_check
    check (week between 1 and 18),
  constraint picker_clicker_week_assignments_source_player_id_length_check
    check (
      char_length(btrim(source_player_id))
      between 1 and 100
    ),
  constraint picker_clicker_week_assignments_source_player_name_length_check
    check (
      char_length(btrim(source_player_name))
      between 1 and 80
    ),
  constraint picker_clicker_week_assignments_source_nfl_team_format_check
    check (source_nfl_team ~ '^[A-Z]{2,3}$'),
  constraint picker_clicker_week_assignments_cycle_number_check
    check (cycle_number >= 1),
  constraint picker_clicker_week_assignments_cycle_source_key
    unique (
      league_id,
      season,
      cycle_number,
      source_player_id
    )
);

create index picker_clicker_week_assignments_source_index
on public.picker_clicker_week_assignments (
  league_id,
  season,
  source_player_id
);

create or replace function
  public.validate_picker_clicker_week_assignment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  league_season integer;
  source_name text;
  source_team text;
  source_status public.league_player_status;
begin
  new.source_player_id := nullif(
    btrim(new.source_player_id),
    ''
  );

  if new.source_player_id is null then
    raise exception
      'A Picker Clicker assignment requires a source player.';
  end if;

  select leagues.season
  into league_season
  from public.leagues as leagues
  where leagues.id = new.league_id;

  if not found then
    raise exception
      'The Picker Clicker assignment must target an existing league.';
  end if;

  if new.season <> league_season then
    raise exception
      'The Picker Clicker assignment season must match the league season.';
  end if;

  select
    players.display_name,
    players.nfl_team,
    players.status
  into
    source_name,
    source_team,
    source_status
  from public.league_players as players
  where players.league_id = new.league_id
    and players.player_id = new.source_player_id;

  if not found then
    raise exception
      'The Picker Clicker source must be an existing league player.';
  end if;

  if source_status <> 'active' then
    raise exception
      'The Picker Clicker source must be an active league player.';
  end if;

  new.source_player_name := btrim(source_name);
  new.source_nfl_team := upper(btrim(source_team));

  if auth.uid() is not null then
    new.created_by := auth.uid();
  end if;

  return new;
end;
$$;

create trigger picker_clicker_week_assignments_validate
before insert
on public.picker_clicker_week_assignments
for each row
execute function
  public.validate_picker_clicker_week_assignment();

alter table public.picker_clicker_week_assignments
  enable row level security;

create policy picker_clicker_week_assignments_select_members
on public.picker_clicker_week_assignments
for select
to authenticated
using (
  public.is_league_member(league_id)
  or public.can_bootstrap_league(league_id)
);

create policy picker_clicker_week_assignments_insert_managers
on public.picker_clicker_week_assignments
for insert
to authenticated
with check (
  public.can_manage_league(league_id)
  or public.can_bootstrap_league(league_id)
);

revoke all on table
  public.picker_clicker_week_assignments
from public, anon, authenticated;

grant select, insert
on table public.picker_clicker_week_assignments
to authenticated;

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
    6 as schema_version,
    'head2head-brawlin'::text as service,
    now() as checked_at
$$;

revoke all on function public.cloud_connection_status()
from public;

grant execute on function public.cloud_connection_status()
to anon, authenticated;

comment on table
  public.picker_clicker_week_assignments
is
  'Immutable cloud-authoritative Picker Clicker source assignment per league week. Members read; commissioners create.';

comment on column
  public.picker_clicker_week_assignments.source_player_id
is
  'Active league player whose later weekly picks are followed by deliberate Picker Clicker choices.';

comment on column
  public.picker_clicker_week_assignments.source_player_name
is
  'Roster display-name snapshot captured by the database at assignment creation.';

comment on column
  public.picker_clicker_week_assignments.source_nfl_team
is
  'Roster NFL-team snapshot captured by the database at assignment creation.';

comment on column
  public.picker_clicker_week_assignments.cycle_number
is
  'Rotation cycle. A source player may appear only once within a league-season cycle.';

comment on function public.cloud_connection_status()
is
  'Browser-safe schema health check. Version 6 includes the cloud Picker Clicker assignment foundation.';

notify pgrst, 'reload schema';

commit;

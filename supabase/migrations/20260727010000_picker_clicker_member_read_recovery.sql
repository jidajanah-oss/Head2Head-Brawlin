begin;

create or replace function
public.load_picker_clicker_week_assignments(
  target_league_id uuid,
  target_season integer default null,
  target_week smallint default null
)
returns table (
  league_id uuid,
  season integer,
  week smallint,
  source_player_id text,
  source_player_name text,
  source_nfl_team text,
  cycle_number integer,
  assigned_at timestamptz,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception
      'Authentication is required to load Picker Clicker assignments.';
  end if;

  if target_league_id is null then
    raise exception
      'A league is required to load Picker Clicker assignments.';
  end if;

  if target_season is not null
    and target_season not between 2000 and 2100 then
    raise exception
      'The Picker Clicker season must be between 2000 and 2100.';
  end if;

  if target_week is not null
    and target_week not between 1 and 18 then
    raise exception
      'The Picker Clicker week must be between 1 and 18.';
  end if;

  if not exists (
    select 1
    from public.account_links as links
    join public.league_players as players
      on players.league_id =
        links.league_id
     and players.player_id =
        links.player_id
    where links.league_id =
        target_league_id
      and links.user_id =
        auth.uid()
      and links.active
      and players.status =
        'active'
  ) then
    raise exception
      'A linked active league member is required to load Picker Clicker assignments.';
  end if;

  return query
  select
    assignments.league_id,
    assignments.season,
    assignments.week,
    assignments.source_player_id,
    assignments.source_player_name,
    assignments.source_nfl_team,
    assignments.cycle_number,
    assignments.assigned_at,
    assignments.created_at
  from
    public.picker_clicker_week_assignments
      as assignments
  where assignments.league_id =
      target_league_id
    and (
      target_season is null
      or assignments.season =
        target_season
    )
    and (
      target_week is null
      or assignments.week =
        target_week
    )
  order by
    assignments.season,
    assignments.week;
end;
$$;

revoke all on function
public.load_picker_clicker_week_assignments(
  uuid,
  integer,
  smallint
)
from public, anon;

grant execute on function
public.load_picker_clicker_week_assignments(
  uuid,
  integer,
  smallint
)
to authenticated;

comment on function
public.load_picker_clicker_week_assignments(
  uuid,
  integer,
  smallint
)
is
  'Returns cloud-authoritative Picker Clicker assignments after directly validating the signed-in user has an active linked league-player account.';

notify pgrst, 'reload schema';

commit;

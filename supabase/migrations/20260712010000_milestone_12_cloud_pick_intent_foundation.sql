begin;

-- The original table required a selected team for every row. A deliberate
-- player-selected Picker Clicker choice is an intent, not a frozen team pick,
-- so its selected_team remains null while the assigned source player's later
-- choice is followed by the scoring/runtime layer.
alter table public.player_picks
  alter column selected_team drop not null,
  add column if not exists picker_clicker_source_player_id text;

-- No browser runtime wrote automatic Picker Clicker rows before this package.
-- If an early test row used the old picker_clicker source with a frozen team,
-- preserve that concrete team as a normal player pick before enforcing the
-- new intent shape.
update public.player_picks
set
  source = 'player',
  picker_clicker_source_player_id = null,
  updated_at = now()
where source = 'picker_clicker'
  and selected_team is not null;

do $constraint$
begin
  alter table public.player_picks
    add constraint player_picks_picker_clicker_source_player_fk
    foreign key (
      league_id,
      picker_clicker_source_player_id
    )
    references public.league_players (
      league_id,
      player_id
    )
    on delete restrict;
exception
  when duplicate_object then null;
end;
$constraint$;

do $constraint$
begin
  alter table public.player_picks
    add constraint player_picks_intent_shape_check
    check (
      (
        source = 'picker_clicker'
        and selected_team is null
        and picker_clicker_source_player_id is not null
        and picker_clicker_source_player_id <> player_id
      )
      or
      (
        source in ('player', 'commissioner')
        and selected_team is not null
        and picker_clicker_source_player_id is null
      )
    );
exception
  when duplicate_object then null;
end;
$constraint$;

create index if not exists
  player_picks_picker_clicker_source_index
on public.player_picks (
  league_id,
  week,
  picker_clicker_source_player_id
)
where source = 'picker_clicker';

create or replace function public.validate_player_pick()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  game_week smallint;
  game_away_team text;
  game_home_team text;
  source_player_is_active boolean;
begin
  select
    games.week,
    games.away_team,
    games.home_team
  into
    game_week,
    game_away_team,
    game_home_team
  from public.league_games as games
  where games.league_id = new.league_id
    and games.game_id = new.game_id;

  if not found then
    raise exception 'The pick must target an existing league game.';
  end if;

  new.week := game_week;

  if new.source = 'picker_clicker' then
    if new.selected_team is not null then
      raise exception 'A Picker Clicker intent cannot freeze a selected team.';
    end if;

    new.picker_clicker_source_player_id := nullif(
      btrim(new.picker_clicker_source_player_id),
      ''
    );

    if new.picker_clicker_source_player_id is null then
      raise exception 'A Picker Clicker intent requires a source player.';
    end if;

    if new.picker_clicker_source_player_id = new.player_id then
      raise exception 'A player cannot use themselves as the Picker Clicker source.';
    end if;

    select exists (
      select 1
      from public.league_players as source_players
      where source_players.league_id = new.league_id
        and source_players.player_id = new.picker_clicker_source_player_id
        and source_players.status = 'active'
    )
    into source_player_is_active;

    if not source_player_is_active then
      raise exception 'The Picker Clicker source must be an active league player.';
    end if;
  else
    new.selected_team := upper(btrim(new.selected_team));
    new.picker_clicker_source_player_id := null;

    if new.selected_team is null
       or new.selected_team not in (
         game_away_team,
         game_home_team
       ) then
      raise exception 'The selected team must be the home or away team for the game.';
    end if;
  end if;

  if auth.uid() is not null then
    if not coalesce(
      public.can_manage_league(new.league_id),
      false
    ) and new.source not in (
      'player',
      'picker_clicker'
    ) then
      raise exception 'Players may create only manual or deliberate Picker Clicker choices.';
    end if;

    if tg_op = 'INSERT' then
      new.created_by := auth.uid();
    else
      new.created_by := old.created_by;
    end if;

    new.updated_by := auth.uid();
  end if;

  return new;
end;
$$;

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
    5 as schema_version,
    'head2head-brawlin'::text as service,
    now() as checked_at
$$;

revoke all on function public.cloud_connection_status()
from public;

grant execute on function public.cloud_connection_status()
to anon, authenticated;

comment on column
  public.player_picks.picker_clicker_source_player_id
is
  'Assigned weekly source player for a deliberate player-selected Picker Clicker intent. Null for manual picks.';

comment on column public.player_picks.selected_team
is
  'Concrete away/home team for manual picks. Null for deliberate Picker Clicker intents so later source changes remain effective.';

comment on column public.player_picks.source
is
  'player = manual player choice; picker_clicker = deliberate player-selected third choice; commissioner = commissioner-entered manual choice. Automatic fallback is stored separately.';

comment on table public.player_picks
is
  'Protected player pick intents. Players may store a manual team or a deliberate Picker Clicker choice before lock; automatic fallback remains separate.';

comment on function public.cloud_connection_status()
is
  'Browser-safe schema health check. Version 5 includes the Cloud Pick Intent Foundation.';

notify pgrst, 'reload schema';

commit;

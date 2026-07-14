begin;

-- Returns one protected head-to-head reveal snapshot. Ordinary players may
-- request only their own linked player. Commissioners may inspect a selected
-- player, but the same both-submitted reveal rule always applies.
create or replace function public.get_opponent_pick_reveal(
  target_league_id uuid,
  target_player_id text,
  target_week smallint
)
returns table (
  league_id uuid,
  season integer,
  week smallint,
  viewer_player_id text,
  viewer_player_name text,
  viewer_nfl_team text,
  opponent_player_id text,
  opponent_player_name text,
  opponent_nfl_team text,
  matchup_type text,
  viewer_submission_status text,
  opponent_submission_status text,
  can_reveal boolean,
  revealed_picks jsonb,
  checked_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  normalized_player_id text := nullif(btrim(target_player_id), '');
  resolved_season integer;
  resolved_viewer_name text;
  resolved_viewer_team text;
  resolved_opponent_team text;
  resolved_opponent_player_id text;
  resolved_opponent_player_name text;
  resolved_matchup_type text;
  resolved_viewer_submission_status text;
  resolved_opponent_submission_status text;
  resolved_can_reveal boolean := false;
  resolved_picks jsonb := '[]'::jsonb;
begin
  if auth.uid() is null then
    raise exception 'A signed-in account is required to view opponent picks.';
  end if;

  if target_league_id is null then
    raise exception 'A league is required to view opponent picks.';
  end if;

  if normalized_player_id is null then
    raise exception 'A player is required to view opponent picks.';
  end if;

  if target_week is null or target_week not between 1 and 18 then
    raise exception 'The reveal week must be between 1 and 18.';
  end if;

  if not (
    coalesce(
      public.is_own_league_player(
        target_league_id,
        normalized_player_id
      ),
      false
    )
    or coalesce(
      public.can_manage_league(target_league_id),
      false
    )
  ) then
    raise exception 'The signed-in account cannot view this head-to-head entry.';
  end if;

  select
    leagues.season,
    players.display_name,
    players.nfl_team
  into
    resolved_season,
    resolved_viewer_name,
    resolved_viewer_team
  from public.leagues as leagues
  join public.league_players as players
    on players.league_id = leagues.id
  where leagues.id = target_league_id
    and players.player_id = normalized_player_id
    and players.status = 'active';

  if not found then
    raise exception 'The reveal must target an active league player.';
  end if;

  select
    case
      when games.away_team = resolved_viewer_team then games.home_team
      else games.away_team
    end
  into resolved_opponent_team
  from public.league_games as games
  where games.league_id = target_league_id
    and games.season = resolved_season
    and games.week = target_week
    and resolved_viewer_team in (games.away_team, games.home_team)
  order by games.kickoff_at
  limit 1;

  if not found then
    resolved_matchup_type := 'bye';
    resolved_viewer_submission_status := case
      when exists (
        select 1
        from public.weekly_pick_submissions as submissions
        where submissions.league_id = target_league_id
          and submissions.player_id = normalized_player_id
          and submissions.week = target_week
          and submissions.reopened_at is null
      ) then 'submitted'
      when exists (
        select 1
        from public.weekly_pick_submissions as submissions
        where submissions.league_id = target_league_id
          and submissions.player_id = normalized_player_id
          and submissions.week = target_week
          and submissions.reopened_at is not null
      ) then 'reopened'
      else 'not-submitted'
    end;
    resolved_opponent_submission_status := 'not-applicable';
  else
    select
      players.player_id,
      players.display_name
    into
      resolved_opponent_player_id,
      resolved_opponent_player_name
    from public.league_players as players
    where players.league_id = target_league_id
      and players.nfl_team = resolved_opponent_team
      and players.status = 'active'
    limit 1;

    resolved_viewer_submission_status := case
      when exists (
        select 1
        from public.weekly_pick_submissions as submissions
        where submissions.league_id = target_league_id
          and submissions.player_id = normalized_player_id
          and submissions.week = target_week
          and submissions.reopened_at is null
      ) then 'submitted'
      when exists (
        select 1
        from public.weekly_pick_submissions as submissions
        where submissions.league_id = target_league_id
          and submissions.player_id = normalized_player_id
          and submissions.week = target_week
          and submissions.reopened_at is not null
      ) then 'reopened'
      else 'not-submitted'
    end;

    if resolved_opponent_player_id is null then
      resolved_matchup_type := 'open-opponent';
      resolved_opponent_submission_status := 'not-applicable';
    else
      resolved_matchup_type := 'owned-opponent';
      resolved_opponent_submission_status := case
        when exists (
          select 1
          from public.weekly_pick_submissions as submissions
          where submissions.league_id = target_league_id
            and submissions.player_id = resolved_opponent_player_id
            and submissions.week = target_week
            and submissions.reopened_at is null
        ) then 'submitted'
        when exists (
          select 1
          from public.weekly_pick_submissions as submissions
          where submissions.league_id = target_league_id
            and submissions.player_id = resolved_opponent_player_id
            and submissions.week = target_week
            and submissions.reopened_at is not null
        ) then 'reopened'
        else 'not-submitted'
      end;

      resolved_can_reveal :=
        resolved_viewer_submission_status = 'submitted'
        and resolved_opponent_submission_status = 'submitted';

      if resolved_can_reveal then
        select coalesce(
          jsonb_agg(
            jsonb_build_object(
              'gameId', games.game_id,
              'awayTeam', games.away_team,
              'homeTeam', games.home_team,
              'kickoffAt', games.kickoff_at,
              'gameStatus', games.status::text,
              'locked', not public.is_pick_open(
                target_league_id,
                games.game_id
              ),
              'intentType', case
                when opponent_picks.source = 'picker_clicker'
                  then 'picker-clicker-selected'
                when opponent_picks.source in ('player', 'commissioner')
                  then 'manual'
                when not public.is_pick_open(
                  target_league_id,
                  games.game_id
                )
                  and assignments.source_player_id is not null
                  and assignments.source_player_id <> resolved_opponent_player_id
                  then 'picker-clicker-auto'
                else 'missing'
              end,
              'pickSource', opponent_picks.source::text,
              'selectedTeam', opponent_picks.selected_team,
              'effectiveTeam', case
                when opponent_picks.source in ('player', 'commissioner')
                  then opponent_picks.selected_team
                when opponent_picks.source = 'picker_clicker'
                  then selected_source_picks.selected_team
                when not public.is_pick_open(
                  target_league_id,
                  games.game_id
                )
                  and assignments.source_player_id is not null
                  and assignments.source_player_id <> resolved_opponent_player_id
                  then automatic_source_picks.selected_team
                else null
              end,
              'sourcePlayerId', case
                when opponent_picks.source = 'picker_clicker'
                  then opponent_picks.picker_clicker_source_player_id
                when not public.is_pick_open(
                  target_league_id,
                  games.game_id
                )
                  and opponent_picks.game_id is null
                  and assignments.source_player_id is not null
                  and assignments.source_player_id <> resolved_opponent_player_id
                  then assignments.source_player_id
                else null
              end,
              'sourcePlayerName', case
                when opponent_picks.source = 'picker_clicker'
                  then selected_source_players.display_name
                when not public.is_pick_open(
                  target_league_id,
                  games.game_id
                )
                  and opponent_picks.game_id is null
                  and assignments.source_player_id is not null
                  and assignments.source_player_id <> resolved_opponent_player_id
                  then assignments.source_player_name
                else null
              end
            )
            order by games.kickoff_at, games.game_id
          ),
          '[]'::jsonb
        )
        into resolved_picks
        from public.league_games as games
        left join public.player_picks as opponent_picks
          on opponent_picks.league_id = games.league_id
          and opponent_picks.player_id = resolved_opponent_player_id
          and opponent_picks.game_id = games.game_id
          and opponent_picks.week = games.week
        left join public.league_players as selected_source_players
          on selected_source_players.league_id = opponent_picks.league_id
          and selected_source_players.player_id =
            opponent_picks.picker_clicker_source_player_id
        left join public.player_picks as selected_source_picks
          on selected_source_picks.league_id = games.league_id
          and selected_source_picks.player_id =
            opponent_picks.picker_clicker_source_player_id
          and selected_source_picks.game_id = games.game_id
          and selected_source_picks.week = games.week
          and selected_source_picks.source in ('player', 'commissioner')
        left join public.picker_clicker_week_assignments as assignments
          on assignments.league_id = games.league_id
          and assignments.season = games.season
          and assignments.week = games.week
        left join public.player_picks as automatic_source_picks
          on automatic_source_picks.league_id = games.league_id
          and automatic_source_picks.player_id = assignments.source_player_id
          and automatic_source_picks.game_id = games.game_id
          and automatic_source_picks.week = games.week
          and automatic_source_picks.source in ('player', 'commissioner')
        where games.league_id = target_league_id
          and games.season = resolved_season
          and games.week = target_week;
      end if;
    end if;
  end if;

  return query
  select
    target_league_id,
    resolved_season,
    target_week,
    normalized_player_id,
    resolved_viewer_name,
    resolved_viewer_team,
    resolved_opponent_player_id,
    resolved_opponent_player_name,
    resolved_opponent_team,
    resolved_matchup_type,
    resolved_viewer_submission_status,
    resolved_opponent_submission_status,
    resolved_can_reveal,
    resolved_picks,
    now();
end;
$$;

revoke all on function public.get_opponent_pick_reveal(uuid, text, smallint)
  from public;

grant execute on function public.get_opponent_pick_reveal(uuid, text, smallint)
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
    8 as schema_version,
    'head2head-brawlin'::text as service,
    now() as checked_at
$$;

revoke all on function public.cloud_connection_status()
  from public;

grant execute on function public.cloud_connection_status()
  to anon, authenticated;

comment on function public.get_opponent_pick_reveal(uuid, text, smallint) is
  'Returns opponent pick details only when both owned head-to-head players have submitted the requested week. Ordinary players may request only their own linked player; commissioners may inspect a selected player under the same reveal rule.';

comment on function public.cloud_connection_status() is
  'Browser-safe schema health check. Version 8 includes protected head-to-head opponent pick reveal.';

notify pgrst, 'reload schema';

commit;

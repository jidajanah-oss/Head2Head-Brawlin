-- Repair protected 2026 test reset.
-- Qualifies league_id, season, and id predicates so they do not
-- conflict with RETURNS TABLE output-variable names.

create or replace function public.reset_current_season_test_data(
  target_league_id uuid,
  confirmation_text text
)
returns table(
  reset_id uuid,
  league_id uuid,
  season integer,
  reset_at timestamptz,
  deleted_player_pick_count integer,
  deleted_submission_count integer,
  deleted_picker_clicker_assignment_count integer,
  deleted_scoring_record_count integer,
  cleared_game_result_count integer
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_league public.leagues%rowtype;
  v_reset_id uuid := extensions.gen_random_uuid();
  v_reset_at timestamptz := now();
  v_snapshot jsonb;
  v_deleted_player_pick_count integer := 0;
  v_deleted_submission_count integer := 0;
  v_deleted_assignment_count integer := 0;
  v_deleted_scoring_count integer := 0;
  v_cleared_game_result_count integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.';
  end if;

  if btrim(coalesce(confirmation_text, '')) <> 'RESET 2026' then
    raise exception 'Type RESET 2026 exactly to continue.';
  end if;

  select leagues.*
  into v_league
  from public.leagues as leagues
  where leagues.id = target_league_id
  for update;

  if not found then
    raise exception 'The active league was not found.';
  end if;

  if v_league.season <> 2026 then
    raise exception 'Only the active 2026 season can be reset.';
  end if;

  if v_league.status in ('complete', 'archived') then
    raise exception 'A completed or archived season cannot be reset.';
  end if;

  if public.current_league_role(target_league_id) <> 'commissioner' then
    raise exception 'Only the primary commissioner can reset the active season.';
  end if;

  select jsonb_build_object(
    'league',
    jsonb_build_object(
      'id', v_league.id,
      'season', v_league.season,
      'currentWeek', v_league.current_week,
      'status', v_league.status
    ),
    'playerPicks',
    coalesce(
      (
        select jsonb_agg(
          to_jsonb(picks)
          order by picks.player_id, picks.week, picks.game_id
        )
        from public.player_picks as picks
        where picks.league_id = target_league_id
      ),
      '[]'::jsonb
    ),
    'weeklySubmissions',
    coalesce(
      (
        select jsonb_agg(
          to_jsonb(submissions)
          order by submissions.player_id, submissions.week
        )
        from public.weekly_pick_submissions as submissions
        where submissions.league_id = target_league_id
      ),
      '[]'::jsonb
    ),
    'pickerClickerAssignments',
    coalesce(
      (
        select jsonb_agg(
          to_jsonb(assignments)
          order by assignments.week
        )
        from public.picker_clicker_week_assignments as assignments
        where assignments.league_id = target_league_id
          and assignments.season = v_league.season
      ),
      '[]'::jsonb
    ),
    'weeklyScoringRecords',
    coalesce(
      (
        select jsonb_agg(
          to_jsonb(records)
          order by records.week
        )
        from public.weekly_scoring_records as records
        where records.league_id = target_league_id
          and records.season = v_league.season
      ),
      '[]'::jsonb
    ),
    'leagueGameResults',
    coalesce(
      (
        select jsonb_agg(
          to_jsonb(games)
          order by games.week, games.kickoff_at, games.game_id
        )
        from public.league_games as games
        where games.league_id = target_league_id
          and games.season = v_league.season
      ),
      '[]'::jsonb
    )
  )
  into v_snapshot;

  insert into public.season_test_reset_audits (
    reset_id,
    league_id,
    season,
    previous_current_week,
    reset_at,
    reset_by,
    snapshot
  )
  values (
    v_reset_id,
    target_league_id,
    v_league.season,
    v_league.current_week,
    v_reset_at,
    auth.uid(),
    v_snapshot
  );

  delete from public.player_picks as picks
  where picks.league_id = target_league_id;

  get diagnostics
    v_deleted_player_pick_count = row_count;

  delete from public.weekly_pick_submissions as submissions
  where submissions.league_id = target_league_id;

  get diagnostics
    v_deleted_submission_count = row_count;

  delete from public.picker_clicker_week_assignments as assignments
  where assignments.league_id = target_league_id
    and assignments.season = v_league.season;

  get diagnostics
    v_deleted_assignment_count = row_count;

  delete from public.weekly_scoring_records as records
  where records.league_id = target_league_id
    and records.season = v_league.season;

  get diagnostics
    v_deleted_scoring_count = row_count;

  update public.league_games as games
  set
    status = 'scheduled',
    away_score = null,
    home_score = null,
    winner_team = null,
    updated_at = now()
  where games.league_id = target_league_id
    and games.season = v_league.season
    and (
      games.status <> 'scheduled'
      or games.away_score is not null
      or games.home_score is not null
      or games.winner_team is not null
    );

  get diagnostics
    v_cleared_game_result_count = row_count;

  update public.leagues as leagues
  set
    current_week = 1,
    updated_at = now()
  where leagues.id = target_league_id;

  update public.season_test_reset_audits as audits
  set
    deleted_player_pick_count =
      v_deleted_player_pick_count,
    deleted_submission_count =
      v_deleted_submission_count,
    deleted_picker_clicker_assignment_count =
      v_deleted_assignment_count,
    deleted_scoring_record_count =
      v_deleted_scoring_count,
    cleared_game_result_count =
      v_cleared_game_result_count
  where audits.reset_id = v_reset_id;

  insert into public.season_reset_events (
    reset_id,
    league_id,
    season,
    reset_at
  )
  values (
    v_reset_id,
    target_league_id,
    v_league.season,
    v_reset_at
  );

  return query
  select
    v_reset_id,
    target_league_id,
    v_league.season,
    v_reset_at,
    v_deleted_player_pick_count,
    v_deleted_submission_count,
    v_deleted_assignment_count,
    v_deleted_scoring_count,
    v_cleared_game_result_count;
end;
$function$;

begin;

-- Fix the weekly submission RPC conflict target.
-- The function returns columns named league_id, player_id, and week, so an
-- unqualified ON CONFLICT column list is ambiguous inside PL/pgSQL.
-- Targeting the table's primary-key constraint removes that ambiguity.

create or replace function public.submit_weekly_picks(
  target_league_id uuid,
  target_player_id text,
  target_week smallint
)
returns table (
  league_id uuid,
  player_id text,
  week smallint,
  submitted_at timestamptz,
  reopened_at timestamptz,
  updated_by uuid,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_player_id text := nullif(btrim(target_player_id), '');
  league_season integer;
  league_current_week smallint;
  scheduled_game_count integer;
  missing_open_pick_count integer;
begin
  if auth.uid() is null then
    raise exception 'A signed-in account is required to submit weekly picks.';
  end if;

  if target_league_id is null then
    raise exception 'A league is required to submit weekly picks.';
  end if;

  if normalized_player_id is null then
    raise exception 'A player is required to submit weekly picks.';
  end if;

  if target_week is null or target_week not between 1 and 18 then
    raise exception 'The submission week must be between 1 and 18.';
  end if;

  if not coalesce(
    public.is_own_league_player(
      target_league_id,
      normalized_player_id
    ),
    false
  ) then
    raise exception 'Players may submit only their own linked weekly entry.';
  end if;

  select
    leagues.season,
    leagues.current_week
  into
    league_season,
    league_current_week
  from public.leagues as leagues
  where leagues.id = target_league_id;

  if not found then
    raise exception 'The submission must target an existing league.';
  end if;

  if league_current_week <> target_week then
    raise exception 'Only the league current week may be submitted.';
  end if;

  select count(*)::integer
  into scheduled_game_count
  from public.league_games as games
  where games.league_id = target_league_id
    and games.season = league_season
    and games.week = target_week;

  if scheduled_game_count = 0 then
    raise exception 'The cloud schedule is not ready for this week.';
  end if;

  select count(*)::integer
  into missing_open_pick_count
  from public.league_games as games
  where games.league_id = target_league_id
    and games.season = league_season
    and games.week = target_week
    and public.is_pick_open(target_league_id, games.game_id)
    and not exists (
      select 1
      from public.player_picks as picks
      where picks.league_id = games.league_id
        and picks.player_id = normalized_player_id
        and picks.game_id = games.game_id
        and picks.week = games.week
    );

  if missing_open_pick_count > 0 then
    raise exception 'Open games are still missing cloud pick intent.'
      using detail = format(
        '%s open game(s) still require a manual or deliberate Picker Clicker choice.',
        missing_open_pick_count
      );
  end if;

  return query
  insert into public.weekly_pick_submissions as submissions (
    league_id,
    player_id,
    week,
    submitted_at,
    reopened_at,
    updated_by
  )
  values (
    target_league_id,
    normalized_player_id,
    target_week,
    now(),
    null,
    auth.uid()
  )
  on conflict on constraint weekly_pick_submissions_pkey
  do update
  set
    submitted_at = excluded.submitted_at,
    reopened_at = null,
    updated_by = auth.uid()
  returning
    submissions.league_id,
    submissions.player_id,
    submissions.week,
    submissions.submitted_at,
    submissions.reopened_at,
    submissions.updated_by,
    submissions.created_at,
    submissions.updated_at;
end;
$$;

revoke all on function public.submit_weekly_picks(uuid, text, smallint)
  from public;

grant execute on function public.submit_weekly_picks(uuid, text, smallint)
  to authenticated;

comment on function public.submit_weekly_picks(uuid, text, smallint) is
  'Submits only the signed-in linked player current week after every still-open game has a deliberate cloud pick intent. Conflict handling targets the weekly submission primary-key constraint explicitly.';

notify pgrst, 'reload schema';

commit;

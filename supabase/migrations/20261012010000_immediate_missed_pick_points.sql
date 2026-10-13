begin;

-- Read-only scores: missed locked picks award the opponent a point immediately.
-- Manual and deliberately selected Picker Clicker picks keep normal NFL credit.
-- Prize eligibility and finalized history are not changed by this function.
create or replace function public.load_live_matchup_scores(
  target_league_id uuid,
  target_season integer,
  target_week smallint
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  -- Preserve the deployed active account-link membership check.
  if auth.uid() is null or not exists (
    select 1 from public.account_links links
    join public.league_players linked_player
      on linked_player.league_id = links.league_id and linked_player.player_id = links.player_id
    where links.league_id = target_league_id and links.user_id = auth.uid()
      and links.active and linked_player.status = 'active'
  ) then
    raise exception 'League membership is required.' using errcode = '42501';
  end if;
  if target_week is null or target_week not between 1 and 18 or
     not exists (select 1 from public.leagues l where l.id = target_league_id and l.season = target_season and target_week <= l.current_week) then
    raise exception 'Select a valid league season and week.';
  end if;

  with week_games as (
    select g.*, not public.is_pick_open(target_league_id, g.game_id) as locked
    from public.league_games g
    where g.league_id = target_league_id and g.season = target_season and g.week = target_week
  ), active_players as (
    select p.player_id, upper(btrim(p.nfl_team)) as nfl_team
    from public.league_players p
    where p.league_id = target_league_id and p.status = 'active'
  ), opponents as (
    select p.player_id, opponent.player_id as opponent_id
    from active_players p
    join week_games schedule on p.nfl_team in (schedule.home_team, schedule.away_team)
    left join active_players opponent on opponent.nfl_team =
      case when p.nfl_team = schedule.home_team then schedule.away_team else schedule.home_team end
  ), finished as (
    select g.game_id, g.winner_team
    from week_games g
    where g.locked and g.status = 'final'
      and g.away_score is not null and g.home_score is not null
      and g.away_score <> g.home_score and g.winner_team is not null
  ), correct_counts as (
    select p.player_id, count(g.game_id) filter (where
      case
        when pick.source in ('player', 'commissioner') then pick.selected_team
        when pick.source = 'picker_clicker' then selected_source.selected_team
        else null
      end = g.winner_team
    )::integer as correct
    from active_players p
    left join finished g on true
    left join public.player_picks pick on pick.league_id = target_league_id
      and pick.player_id = p.player_id and pick.game_id = g.game_id and pick.week = target_week
    left join public.player_picks selected_source on selected_source.league_id = target_league_id
      and selected_source.player_id = pick.picker_clicker_source_player_id
      and selected_source.game_id = g.game_id and selected_source.week = target_week
      and selected_source.source in ('player', 'commissioner')
    group by p.player_id
  ), missing_counts as (
    select p.player_id, count(g.game_id) filter (where g.locked and pick.game_id is null)::integer as missed
    from active_players p
    left join week_games g on true
    left join public.player_picks pick on pick.league_id = target_league_id
      and pick.player_id = p.player_id and pick.game_id = g.game_id and pick.week = target_week
    group by p.player_id
  ), scores as (
    select p.player_id,
      case when matchup.player_id is null then 0
        else own_picks.correct + coalesce(opponent_misses.missed, 0)
      end as score
    from active_players p
    left join opponents matchup on matchup.player_id = p.player_id
    left join correct_counts own_picks on own_picks.player_id = p.player_id
    left join missing_counts opponent_misses on opponent_misses.player_id = matchup.opponent_id
  )
  select jsonb_build_object(
    'season', target_season, 'week', target_week,
    'completed_games', (select count(*)::integer from finished),
    'locked_games', (select count(*)::integer from week_games where locked),
    'scores', coalesce(jsonb_object_agg(scores.player_id, scores.score), '{}'::jsonb)
  ) into result from scores;
  return result;
end;
$$;

revoke all on function public.load_live_matchup_scores(uuid, integer, smallint) from public;
grant execute on function public.load_live_matchup_scores(uuid, integer, smallint) to authenticated;
comment on function public.load_live_matchup_scores(uuid, integer, smallint)
is 'Member-readable provisional scores: deliberate correct picks plus opponent missing locked-game points. No raw picks, prize eligibility writes, or history changes.';
notify pgrst, 'reload schema';
commit;

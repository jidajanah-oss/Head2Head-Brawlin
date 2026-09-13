begin;

-- A member-readable score summary. Raw selections never cross this boundary.
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
  if auth.uid() is null or not coalesce(public.is_league_member(target_league_id), false) then
    raise exception 'League membership is required.' using errcode = '42501';
  end if;
  if target_week is null or target_week not between 1 and 18 or
     not exists (select 1 from public.leagues l where l.id = target_league_id and l.season = target_season and target_week <= l.current_week) then
    raise exception 'Select a valid league season and week.';
  end if;

  with finished as (
    select g.game_id, g.winner_team
    from public.league_games g
    where g.league_id = target_league_id and g.season = target_season
      and g.week = target_week and g.status = 'final'
      and g.away_score is not null and g.home_score is not null
      and g.away_score <> g.home_score and g.winner_team is not null
      and not public.is_pick_open(target_league_id, g.game_id)
  ), effective as (
    select p.player_id, g.game_id, g.winner_team,
      case
        when pick.source in ('player', 'commissioner') then pick.selected_team
        when pick.source = 'picker_clicker' then selected_source.selected_team
        when pick.game_id is null and assignment.source_player_id is not null
          and assignment.source_player_id <> p.player_id then automatic_source.selected_team
        else null
      end as effective_team
    from public.league_players p
    cross join finished g
    left join public.player_picks pick on pick.league_id = p.league_id
      and pick.player_id = p.player_id and pick.game_id = g.game_id and pick.week = target_week
    left join public.player_picks selected_source on selected_source.league_id = p.league_id
      and selected_source.player_id = pick.picker_clicker_source_player_id
      and selected_source.game_id = g.game_id and selected_source.week = target_week
      and selected_source.source in ('player', 'commissioner')
    left join public.picker_clicker_week_assignments assignment on assignment.league_id = p.league_id
      and assignment.season = target_season and assignment.week = target_week
    left join public.player_picks automatic_source on automatic_source.league_id = p.league_id
      and automatic_source.player_id = assignment.source_player_id
      and automatic_source.game_id = g.game_id and automatic_source.week = target_week
      and automatic_source.source in ('player', 'commissioner')
    where p.league_id = target_league_id and p.status = 'active'
  ), scores as (
    select p.player_id, count(e.game_id) filter (where e.effective_team = e.winner_team)::integer as score
    from public.league_players p
    left join effective e on e.player_id = p.player_id
    where p.league_id = target_league_id and p.status = 'active'
    group by p.player_id
  )
  select jsonb_build_object(
    'season', target_season, 'week', target_week,
    'completed_games', (select count(*)::integer from finished),
    'scores', coalesce(jsonb_object_agg(scores.player_id, scores.score), '{}'::jsonb)
  ) into result from scores;
  return result;
end;
$$;

revoke all on function public.load_live_matchup_scores(uuid, integer, smallint) from public;
grant execute on function public.load_live_matchup_scores(uuid, integer, smallint) to authenticated;
notify pgrst, 'reload schema';
commit;

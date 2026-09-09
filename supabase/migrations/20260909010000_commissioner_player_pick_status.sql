begin;

-- Completion counts only. Never return selected teams or source-player picks.
create or replace function public.load_commissioner_player_pick_status(
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
  league_season integer;
  league_week smallint;
  result jsonb;
begin
  if auth.uid() is null or not coalesce(public.can_manage_league(target_league_id), false) then
    raise exception 'Commissioner access is required to view player pick status.' using errcode = '42501';
  end if;

  select l.season, l.current_week into league_season, league_week
  from public.leagues as l where l.id = target_league_id;

  if target_season is null or target_season is distinct from league_season then
    raise exception 'Select the league current season.';
  end if;
  if target_week is null or target_week < 1 or target_week > league_week or target_week > 18 then
    raise exception 'Select the current week or an earlier regular-season week.';
  end if;

  with week_games as (
    select g.game_id, not public.is_pick_open(target_league_id, g.game_id) as locked
    from public.league_games as g
    where g.league_id = target_league_id and g.season = target_season and g.week = target_week
  ), player_counts as (
    select lp.player_id, lp.display_name, lp.nfl_team,
      count(p.game_id)::integer as picked_count,
      count(g.game_id) filter (where g.locked and p.game_id is null)::integer as locked_missing_count
    from public.league_players as lp
    left join week_games as g on true
    left join public.player_picks as p
      on p.league_id = lp.league_id and p.player_id = lp.player_id
      and p.game_id = g.game_id and p.week = target_week
    where lp.league_id = target_league_id and lp.status = 'active'
    group by lp.player_id, lp.display_name, lp.nfl_team
  )
  select jsonb_build_object(
    'league_id', target_league_id,
    'season', target_season,
    'week', target_week,
    'total_games', (select count(*)::integer from week_games),
    'locked_games', (select count(*)::integer from week_games where locked),
    'players', coalesce((select jsonb_agg(jsonb_build_object(
      'player_id', pc.player_id, 'display_name', pc.display_name, 'nfl_team', pc.nfl_team,
      'picked_count', pc.picked_count, 'locked_missing_count', pc.locked_missing_count
    ) order by lower(pc.display_name), pc.player_id) from player_counts as pc), '[]'::jsonb)
  ) into result;
  return result;
end;
$$;

revoke all on function public.load_commissioner_player_pick_status(uuid, integer, smallint) from public;
grant execute on function public.load_commissioner_player_pick_status(uuid, integer, smallint) to authenticated;
comment on function public.load_commissioner_player_pick_status(uuid, integer, smallint)
is 'Read-only current-season completion counts for primary and backup commissioners. Uses existing game locks. Returns no selected teams or pick source details.';

notify pgrst, 'reload schema';
commit;

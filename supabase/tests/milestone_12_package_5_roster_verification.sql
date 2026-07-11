select
  leagues.name as league_name,
  leagues.season,
  count(*) filter (
    where players.status = 'active'
  ) as active_player_count,
  count(*) filter (
    where players.status = 'active'
      and players.role = 'commissioner'
  ) as active_commissioner_count,
  count(*) filter (
    where players.display_name in (
      'Player 1',
      'Player 2',
      'Player 3',
      'Player 4',
      'Brandon',
      'Brenton',
      'Dot'
    )
  ) as placeholder_player_count,
  bool_and(
    players.display_name = 'Jimbo'
    and players.nfl_team = 'WAS'
    and players.role = 'commissioner'
    and players.status = 'active'
  ) as only_jimbo_is_active_commissioner
from public.leagues as leagues
join public.league_players as players
  on players.league_id = leagues.id
where leagues.slug = 'head2head-brawlin-2026'
group by
  leagues.name,
  leagues.season;

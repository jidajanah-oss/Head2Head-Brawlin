-- Head2Head Brawlin' - Milestone 12 Package 4 verification
-- Run with the Supabase SQL Editor postgres role.
-- This query intentionally does not return an email address or user UUID.

select
  leagues.name as league_name,
  leagues.season,
  players.display_name,
  players.nfl_team,
  players.role,
  players.status,
  links.active as account_link_active,
  auth_users.id is not null as auth_user_exists,
  (
    select count(*)
    from public.league_players as commissioner_count
    where commissioner_count.league_id = leagues.id
      and commissioner_count.role = 'commissioner'
      and commissioner_count.status = 'active'
  ) as active_commissioner_count
from public.leagues as leagues
join public.league_players as players
  on players.league_id = leagues.id
join public.account_links as links
  on links.league_id = players.league_id
 and links.player_id = players.player_id
left join auth.users as auth_users
  on auth_users.id = links.user_id
where leagues.slug = 'head2head-brawlin-2026'
  and players.role = 'commissioner'
  and players.status = 'active'
  and links.active
order by players.display_name;

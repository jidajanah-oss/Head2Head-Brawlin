begin;

-- Production is_league_member reads league_members, while player sign-in uses
-- active account_links. Advance Picks must be able to read the published card
-- for those linked players too. This adds SELECT only; no schedule writes or
-- access to another player's picks is granted.
drop policy if exists league_games_read_linked_players on public.league_games;
create policy league_games_read_linked_players
on public.league_games
for select
to authenticated
using (
  public.current_league_role(league_id)
    in ('commissioner', 'backup_commissioner', 'player')
);

notify pgrst, 'reload schema';
commit;

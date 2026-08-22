-- Head2Head Brawlin'
-- Fresh-device Week 1 pick hydration repair
--
-- Fresh browsers must be able to read league_games while RLS remains enabled.
-- CloudPlayerPickIntentSync synchronizes/reads league games before restoring
-- the player's saved cloud pick intents.

grant usage on schema public to authenticated;

grant select
on table public.league_games
to authenticated;

drop policy if exists league_games_read_members
on public.league_games;

create policy league_games_read_members
on public.league_games
for select
to authenticated
using (
  public.is_league_member(league_id)
  or public.can_manage_league(league_id)
  or public.can_bootstrap_league(league_id)
);

notify pgrst, 'reload schema';

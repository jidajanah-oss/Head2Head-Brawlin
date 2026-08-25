-- Computer Access v1 hotfix
-- Allow the server-side computer-access Edge Function to inspect
-- the player and safely manage account links.

grant select
on table public.league_players
to service_role;

grant select, insert, update
on table public.account_links
to service_role;

grant select, update
on table public.account_link_invitations
to service_role;

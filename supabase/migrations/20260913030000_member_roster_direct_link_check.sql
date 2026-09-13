begin;

-- Return public roster fields to a linked member when the table SELECT policy
-- yields no rows. Check the authenticated account link directly so this read
-- does not depend on the nested current_league_role/is_league_member path.
create or replace function public.load_member_league_roster(target_league_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  roster jsonb;
begin
  if auth.uid() is null or not exists (
    select 1
    from public.account_links as links
    join public.league_players as linked_player
      on linked_player.league_id = links.league_id
     and linked_player.player_id = links.player_id
    where links.league_id = target_league_id
      and links.user_id = auth.uid()
      and links.active
      and linked_player.status = 'active'
  ) then
    raise exception 'League membership is required.' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'player_id', players.player_id,
    'display_name', players.display_name,
    'nfl_team', players.nfl_team,
    'role', players.role::text,
    'status', players.status::text,
    'custom_logo', players.custom_logo
  ) order by players.display_name, players.player_id), '[]'::jsonb)
  into roster
  from public.league_players as players
  where players.league_id = target_league_id
    and players.status = 'active';

  return roster;
end;
$$;

alter function public.load_member_league_roster(uuid) owner to postgres;
revoke all on function public.load_member_league_roster(uuid) from public, anon;
grant execute on function public.load_member_league_roster(uuid) to authenticated;
notify pgrst, 'reload schema';

commit;

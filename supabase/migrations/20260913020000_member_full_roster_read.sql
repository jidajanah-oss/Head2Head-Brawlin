begin;

-- Return public roster fields to a linked league member even if a table read
-- is affected by an older or conflicting row policy. Never return account data.
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
  if auth.uid() is null or not coalesce(public.is_league_member(target_league_id), false) then
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
  from public.league_players players
  where players.league_id = target_league_id and players.status = 'active';

  return roster;
end;
$$;

revoke all on function public.load_member_league_roster(uuid) from public;
grant execute on function public.load_member_league_roster(uuid) to authenticated;
notify pgrst, 'reload schema';
commit;

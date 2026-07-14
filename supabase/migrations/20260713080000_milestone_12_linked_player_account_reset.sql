begin;

create or replace function public.reset_linked_player_account(
  p_league_id uuid,
  p_player_id text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_player_id text := nullif(btrim(p_player_id), '');
  target_role public.league_member_role;
  active_link_id uuid;
begin
  if auth.uid() is null then
    raise exception 'A signed-in account is required to reset a player link.';
  end if;

  if p_league_id is null then
    raise exception 'A league is required to reset a player link.';
  end if;

  if normalized_player_id is null then
    raise exception 'A player is required to reset a player link.';
  end if;

  if not coalesce(
    public.can_manage_accounts(p_league_id),
    false
  ) then
    raise exception 'Only the primary commissioner can reset linked player accounts.';
  end if;

  select players.role
  into target_role
  from public.league_players as players
  where players.league_id = p_league_id
    and players.player_id = normalized_player_id
    and players.status = 'active';

  if not found then
    raise exception 'The reset must target an active league player.';
  end if;

  if target_role = 'commissioner' then
    raise exception 'The primary commissioner account link cannot be reset.';
  end if;

  select links.id
  into active_link_id
  from public.account_links as links
  where links.league_id = p_league_id
    and links.player_id = normalized_player_id
    and links.active
  for update;

  if active_link_id is null then
    return false;
  end if;

  update public.account_link_invitations as invitations
  set
    status = 'revoked',
    updated_at = now()
  where invitations.league_id = p_league_id
    and invitations.player_id = normalized_player_id
    and invitations.status = 'pending';

  update public.account_links as links
  set
    active = false,
    updated_at = now()
  where links.id = active_link_id;

  return true;
end;
$$;

revoke all on function public.reset_linked_player_account(uuid, text)
  from public;

grant execute on function public.reset_linked_player_account(uuid, text)
  to authenticated;

comment on function public.reset_linked_player_account(uuid, text) is
  'Primary-commissioner-only repair action that deactivates a non-primary player account link, revokes stale pending invitations, and preserves the player roster record and league data.';

create or replace function public.cloud_connection_status()
returns table (
  schema_version integer,
  service text,
  checked_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    11 as schema_version,
    'head2head-brawlin'::text as service,
    now() as checked_at
$$;

revoke all on function public.cloud_connection_status()
  from public;

grant execute on function public.cloud_connection_status()
  to anon, authenticated;

notify pgrst, 'reload schema';

commit;

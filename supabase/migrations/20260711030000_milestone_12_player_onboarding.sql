begin;

alter table public.account_link_invitations
  add column if not exists last_sent_at timestamptz,
  add column if not exists send_count integer not null default 0;

do $constraint$
begin
  alter table public.account_link_invitations
    add constraint account_link_invitations_send_count_check
    check (send_count >= 0);
exception
  when duplicate_object then null;
end;
$constraint$;

with duplicate_pending_emails as (
  select invitations.id
  from (
    select
      invitations.id,
      row_number() over (
        partition by invitations.league_id, invitations.email
        order by invitations.created_at desc, invitations.id desc
      ) as duplicate_rank
    from public.account_link_invitations as invitations
    where invitations.status = 'pending'
  ) as ranked_invitations
  join public.account_link_invitations as invitations
    on invitations.id = ranked_invitations.id
  where ranked_invitations.duplicate_rank > 1
)
update public.account_link_invitations as invitations
set
  status = 'revoked',
  updated_at = now()
where invitations.id in (
  select duplicate_pending_emails.id
  from duplicate_pending_emails
);

create unique index if not exists
  account_link_invitations_one_pending_email_per_league
on public.account_link_invitations (league_id, email)
where status = 'pending';

create or replace function public.validate_account_link()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  resolved_email text;
  target_role public.league_member_role;
  target_status public.league_player_status;
  self_claim_inviter uuid;
  self_claim_allowed boolean := false;
begin
  select lower(btrim(users.email))
  into resolved_email
  from auth.users as users
  where users.id = new.user_id;

  if resolved_email is null or resolved_email = '' then
    raise exception 'The linked Supabase user must have an email address.';
  end if;

  select players.role, players.status
  into target_role, target_status
  from public.league_players as players
  where players.league_id = new.league_id
    and players.player_id = new.player_id;

  if not found then
    raise exception 'The account link must target an existing league player.';
  end if;

  if new.active and target_status <> 'active' then
    raise exception 'An active account link must target an active league player.';
  end if;

  if auth.uid() is not null then
    select invitations.created_by
    into self_claim_inviter
    from public.account_link_invitations as invitations
    where invitations.league_id = new.league_id
      and invitations.player_id = new.player_id
      and invitations.email = resolved_email
      and invitations.status = 'pending'
      and (
        invitations.expires_at is null
        or invitations.expires_at > now()
      )
    order by invitations.created_at desc
    limit 1;

    self_claim_allowed :=
      new.user_id = auth.uid()
      and self_claim_inviter is not null;

    if coalesce(public.can_manage_accounts(new.league_id), false) then
      new.linked_by := auth.uid();
    elsif (
      public.can_bootstrap_league(new.league_id)
      and new.user_id = auth.uid()
      and target_role = 'commissioner'
      and target_status = 'active'
    ) then
      new.linked_by := auth.uid();
    elsif self_claim_allowed then
      new.linked_by := self_claim_inviter;
    else
      raise exception 'The account link requires commissioner approval or a matching pending invitation.';
    end if;
  end if;

  new.login_email := resolved_email;
  return new;
end;
$$;

create or replace function public.sync_current_league_roster(
  p_league_id uuid,
  p_players jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  player_value jsonb;
  v_player_id text;
  v_display_name text;
  v_nfl_team text;
  v_role public.league_member_role;
  v_status public.league_player_status;
  v_custom_logo text;
  v_primary_commissioner_id text;
  v_seen_player_ids text[] := array[]::text[];
  v_seen_teams text[] := array[]::text[];
  v_player_count integer := 0;
begin
  if not coalesce(public.can_manage_league(p_league_id), false) then
    raise exception 'Only a commissioner can synchronize the league roster.';
  end if;

  if p_players is null
    or jsonb_typeof(p_players) is distinct from 'array' then
    raise exception 'The roster payload must be a JSON array.';
  end if;

  if jsonb_array_length(p_players) < 1
    or jsonb_array_length(p_players) > 32 then
    raise exception 'The cloud roster must contain between 1 and 32 players.';
  end if;

  select players.player_id
  into v_primary_commissioner_id
  from public.league_players as players
  where players.league_id = p_league_id
    and players.role = 'commissioner'
    and players.status = 'active'
  limit 1;

  if v_primary_commissioner_id is null then
    raise exception 'The league must have one active primary commissioner.';
  end if;

  delete from public.league_players as players
  where players.league_id = p_league_id
    and players.player_id <> v_primary_commissioner_id
    and not exists (
      select 1
      from jsonb_array_elements(p_players) as incoming(value)
      where btrim(coalesce(incoming.value ->> 'id', '')) =
        players.player_id
    )
    and not exists (
      select 1
      from public.account_links as links
      where links.league_id = players.league_id
        and links.player_id = players.player_id
        and links.active
    );

  for player_value in
    select items.value
    from jsonb_array_elements(p_players) as items(value)
  loop
    v_player_id := btrim(coalesce(player_value ->> 'id', ''));
    v_display_name := btrim(coalesce(player_value ->> 'name', ''));
    v_nfl_team := upper(btrim(coalesce(player_value ->> 'nflTeam', '')));
    v_custom_logo := nullif(
      btrim(coalesce(player_value ->> 'customLogo', '')),
      ''
    );

    begin
      v_role := coalesce(
        nullif(btrim(player_value ->> 'role'), '')::public.league_member_role,
        'player'::public.league_member_role
      );
    exception
      when invalid_text_representation then
        raise exception 'The roster contains an invalid player role.';
    end;

    begin
      v_status := coalesce(
        nullif(btrim(player_value ->> 'status'), '')::public.league_player_status,
        'active'::public.league_player_status
      );
    exception
      when invalid_text_representation then
        raise exception 'The roster contains an invalid player status.';
    end;

    if char_length(v_player_id) not between 1 and 100 then
      raise exception 'Every player must have a valid internal player ID.';
    end if;

    if char_length(v_display_name) not between 1 and 80 then
      raise exception 'Every player must have a name between 1 and 80 characters.';
    end if;

    if v_nfl_team !~ '^[A-Z]{2,3}$' then
      raise exception 'Every player must have a valid NFL team abbreviation.';
    end if;

    if v_player_id = any(v_seen_player_ids) then
      raise exception 'The roster contains a duplicate player ID.';
    end if;

    if v_nfl_team = any(v_seen_teams) then
      raise exception 'The roster contains a duplicate NFL team.';
    end if;

    if v_role = 'commissioner'
      and v_player_id <> v_primary_commissioner_id then
      raise exception 'The existing primary commissioner must remain the only primary commissioner.';
    end if;

    if v_player_id = v_primary_commissioner_id
      and (
        v_role <> 'commissioner'
        or v_status <> 'active'
      ) then
      raise exception 'The primary commissioner must remain active and retain the commissioner role.';
    end if;

    v_seen_player_ids := array_append(v_seen_player_ids, v_player_id);
    v_seen_teams := array_append(v_seen_teams, v_nfl_team);

    insert into public.league_players (
      league_id,
      player_id,
      display_name,
      nfl_team,
      role,
      status,
      custom_logo
    )
    values (
      p_league_id,
      v_player_id,
      v_display_name,
      v_nfl_team,
      v_role,
      v_status,
      v_custom_logo
    )
    on conflict (league_id, player_id)
    do update set
      display_name = excluded.display_name,
      nfl_team = excluded.nfl_team,
      role = excluded.role,
      status = excluded.status,
      custom_logo = excluded.custom_logo,
      updated_at = now();

    v_player_count := v_player_count + 1;
  end loop;

  if not (v_primary_commissioner_id = any(v_seen_player_ids)) then
    raise exception 'The synchronized roster must include the primary commissioner.';
  end if;

  return v_player_count;
end;
$$;

create or replace function public.get_player_account_readiness(
  p_league_id uuid
)
returns table (
  player_id text,
  display_name text,
  nfl_team text,
  role public.league_member_role,
  player_status public.league_player_status,
  account_status text,
  email text,
  invitation_id uuid,
  invitation_created_at timestamptz,
  invitation_expires_at timestamptz,
  last_sent_at timestamptz,
  linked_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not coalesce(public.can_manage_accounts(p_league_id), false) then
    raise exception 'Only the primary commissioner can view player account readiness.';
  end if;

  return query
  select
    players.player_id,
    players.display_name,
    players.nfl_team,
    players.role,
    players.status,
    case
      when links.id is not null then 'linked'
      when invitations.id is not null then 'invitation_pending'
      else 'not_linked'
    end as account_status,
    coalesce(links.login_email, invitations.email) as email,
    invitations.id as invitation_id,
    invitations.created_at as invitation_created_at,
    invitations.expires_at as invitation_expires_at,
    invitations.last_sent_at,
    links.linked_at
  from public.league_players as players
  left join lateral (
    select account_links.*
    from public.account_links as account_links
    where account_links.league_id = players.league_id
      and account_links.player_id = players.player_id
      and account_links.active
    order by account_links.linked_at desc
    limit 1
  ) as links on true
  left join lateral (
    select pending.*
    from public.account_link_invitations as pending
    where pending.league_id = players.league_id
      and pending.player_id = players.player_id
      and pending.status = 'pending'
      and (
        pending.expires_at is null
        or pending.expires_at > now()
      )
    order by pending.created_at desc
    limit 1
  ) as invitations on links.id is null
  where players.league_id = p_league_id
    and players.status = 'active'
  order by
    case players.role
      when 'commissioner' then 1
      when 'backup_commissioner' then 2
      else 3
    end,
    players.display_name;
end;
$$;

create or replace function public.prepare_player_account_invitation(
  p_league_id uuid,
  p_player_id text,
  p_email text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_invitation_id uuid;
begin
  if not coalesce(public.can_manage_accounts(p_league_id), false) then
    raise exception 'Only the primary commissioner can prepare player invitations.';
  end if;

  if v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Enter a valid player email address.';
  end if;

  if not exists (
    select 1
    from public.league_players as players
    where players.league_id = p_league_id
      and players.player_id = p_player_id
      and players.status = 'active'
  ) then
    raise exception 'The invitation must target an active league player.';
  end if;

  if exists (
    select 1
    from public.account_links as links
    where links.league_id = p_league_id
      and links.player_id = p_player_id
      and links.active
  ) then
    raise exception 'This player already has a linked account.';
  end if;

  if exists (
    select 1
    from public.account_links as links
    where links.login_email = v_email
      and links.active
      and not (
        links.league_id = p_league_id
        and links.player_id = p_player_id
      )
  ) then
    raise exception 'That email address is already linked to another player.';
  end if;

  update public.account_link_invitations as invitations
  set status = 'expired'
  where invitations.status = 'pending'
    and invitations.expires_at is not null
    and invitations.expires_at <= now();

  if exists (
    select 1
    from public.account_link_invitations as invitations
    where invitations.league_id = p_league_id
      and invitations.email = v_email
      and invitations.status = 'pending'
      and invitations.player_id <> p_player_id
  ) then
    raise exception 'That email address already has a pending invitation for another player.';
  end if;

  select invitations.id
  into v_invitation_id
  from public.account_link_invitations as invitations
  where invitations.league_id = p_league_id
    and invitations.player_id = p_player_id
    and invitations.status = 'pending'
  order by invitations.created_at desc
  limit 1;

  if v_invitation_id is null then
    insert into public.account_link_invitations (
      league_id,
      player_id,
      email,
      status,
      expires_at,
      created_by,
      last_sent_at,
      send_count
    )
    values (
      p_league_id,
      p_player_id,
      v_email,
      'pending',
      now() + interval '14 days',
      auth.uid(),
      null,
      0
    )
    returning id into v_invitation_id;
  else
    update public.account_link_invitations
    set
      email = v_email,
      expires_at = now() + interval '14 days',
      last_sent_at = null,
      send_count = 0,
      updated_at = now()
    where id = v_invitation_id;
  end if;

  return v_invitation_id;
end;
$$;

create or replace function public.revoke_player_account_invitation(
  p_invitation_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_league_id uuid;
begin
  select invitations.league_id
  into v_league_id
  from public.account_link_invitations as invitations
  where invitations.id = p_invitation_id
    and invitations.status = 'pending';

  if v_league_id is null then
    return false;
  end if;

  if not coalesce(public.can_manage_accounts(v_league_id), false) then
    raise exception 'Only the primary commissioner can revoke player invitations.';
  end if;

  update public.account_link_invitations
  set
    status = 'revoked',
    updated_at = now()
  where id = p_invitation_id
    and status = 'pending';

  return found;
end;
$$;

create or replace function public.claim_my_pending_invitation()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_email text;
  v_invitation public.account_link_invitations%rowtype;
  v_link_id uuid;
begin
  if v_user_id is null then
    return false;
  end if;

  select lower(btrim(users.email))
  into v_email
  from auth.users as users
  where users.id = v_user_id;

  if v_email is null or v_email = '' then
    return false;
  end if;

  update public.account_link_invitations as invitations
  set status = 'expired'
  where invitations.email = v_email
    and invitations.status = 'pending'
    and invitations.expires_at is not null
    and invitations.expires_at <= now();

  select invitations.*
  into v_invitation
  from public.account_link_invitations as invitations
  join public.league_players as players
    on players.league_id = invitations.league_id
   and players.player_id = invitations.player_id
  where invitations.email = v_email
    and invitations.status = 'pending'
    and (
      invitations.expires_at is null
      or invitations.expires_at > now()
    )
    and players.status = 'active'
  order by invitations.created_at desc
  limit 1;

  if not found then
    return false;
  end if;

  if exists (
    select 1
    from public.account_links as links
    where links.user_id = v_user_id
      and links.active
      and not (
        links.league_id = v_invitation.league_id
        and links.player_id = v_invitation.player_id
      )
  ) then
    raise exception 'This Supabase user is already linked to another active player.';
  end if;

  if exists (
    select 1
    from public.account_links as links
    where links.league_id = v_invitation.league_id
      and links.player_id = v_invitation.player_id
      and links.active
      and links.user_id <> v_user_id
  ) then
    raise exception 'This league player is already linked to another Supabase user.';
  end if;

  select links.id
  into v_link_id
  from public.account_links as links
  where links.user_id = v_user_id
    and links.league_id = v_invitation.league_id
    and links.player_id = v_invitation.player_id
  order by links.created_at
  limit 1;

  if v_link_id is null then
    insert into public.account_links (
      league_id,
      player_id,
      user_id,
      login_email,
      active,
      linked_by
    )
    values (
      v_invitation.league_id,
      v_invitation.player_id,
      v_user_id,
      v_email,
      true,
      v_invitation.created_by
    );
  else
    update public.account_links
    set
      login_email = v_email,
      active = true,
      linked_by = v_invitation.created_by,
      linked_at = now(),
      updated_at = now()
    where id = v_link_id;
  end if;

  update public.account_link_invitations
  set
    status = 'accepted',
    accepted_by = v_user_id,
    accepted_at = now(),
    updated_at = now()
  where id = v_invitation.id;

  update public.account_link_invitations
  set
    status = 'revoked',
    updated_at = now()
  where email = v_email
    and status = 'pending'
    and id <> v_invitation.id;

  return true;
end;
$$;

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
    4 as schema_version,
    'head2head-brawlin'::text as service,
    now() as checked_at
$$;

revoke all on function public.sync_current_league_roster(uuid, jsonb)
from public;
revoke all on function public.get_player_account_readiness(uuid)
from public;
revoke all on function public.prepare_player_account_invitation(uuid, text, text)
from public;
revoke all on function public.revoke_player_account_invitation(uuid)
from public;
revoke all on function public.claim_my_pending_invitation()
from public;
revoke all on function public.cloud_connection_status()
from public;

grant execute on function public.sync_current_league_roster(uuid, jsonb)
to authenticated;
grant execute on function public.get_player_account_readiness(uuid)
to authenticated;
grant execute on function public.prepare_player_account_invitation(uuid, text, text)
to authenticated;
grant execute on function public.revoke_player_account_invitation(uuid)
to authenticated;
grant execute on function public.claim_my_pending_invitation()
to authenticated;
grant execute on function public.cloud_connection_status()
to anon, authenticated;

comment on function public.sync_current_league_roster(uuid, jsonb) is
  'Idempotently synchronizes the commissioner-managed local roster, removes missing unlinked players, and preserves linked accounts.';

comment on function public.get_player_account_readiness(uuid) is
  'Primary-commissioner-only account status list for active league players.';

comment on function public.prepare_player_account_invitation(uuid, text, text) is
  'Creates or updates a pending invitation without sending email or creating an Auth user.';

comment on function public.revoke_player_account_invitation(uuid) is
  'Revokes a pending player account invitation.';

comment on function public.claim_my_pending_invitation() is
  'Links the signed-in Auth user to a matching active pending player invitation.';

comment on column public.account_link_invitations.last_sent_at is
  'Timestamp recorded by the server-side invite-player Edge Function after Supabase accepts the invite email request.';

comment on column public.account_link_invitations.send_count is
  'Number of successful invitation email requests accepted by Supabase Auth.';

notify pgrst, 'reload schema';

commit;

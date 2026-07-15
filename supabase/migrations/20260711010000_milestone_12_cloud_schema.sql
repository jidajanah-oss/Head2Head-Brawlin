begin;

create extension if not exists pgcrypto with schema extensions;

create type public.league_status as enum (
  'setup',
  'active',
  'complete',
  'archived'
);

create type public.league_member_role as enum (
  'commissioner',
  'backup_commissioner',
  'player'
);

create type public.league_player_status as enum (
  'active',
  'inactive'
);

create type public.league_game_status as enum (
  'scheduled',
  'live',
  'final',
  'canceled'
);

create type public.league_document_visibility as enum (
  'members',
  'commissioners'
);

create type public.pick_source as enum (
  'player',
  'picker_clicker',
  'commissioner'
);

create type public.account_invitation_status as enum (
  'pending',
  'accepted',
  'revoked',
  'expired'
);

create table public.leagues (
  id uuid primary key default extensions.gen_random_uuid(),
  slug text not null unique,
  name text not null,
  season integer not null,
  status public.league_status not null default 'setup',
  current_week smallint not null default 1,
  max_players smallint not null default 32,
  pick_lock_minutes_before_kickoff smallint not null default 5,
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint leagues_slug_format_check
    check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint leagues_name_length_check
    check (char_length(btrim(name)) between 1 and 80),
  constraint leagues_season_check
    check (season between 2000 and 2100),
  constraint leagues_current_week_check
    check (current_week between 1 and 18),
  constraint leagues_max_players_check
    check (max_players between 1 and 32),
  constraint leagues_pick_lock_check
    check (pick_lock_minutes_before_kickoff between 0 and 120)
);

create table public.league_players (
  league_id uuid not null references public.leagues(id) on delete cascade,
  player_id text not null,
  display_name text not null,
  nfl_team text not null,
  role public.league_member_role not null default 'player',
  status public.league_player_status not null default 'active',
  custom_logo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (league_id, player_id),
  constraint league_players_player_id_length_check
    check (char_length(btrim(player_id)) between 1 and 100),
  constraint league_players_display_name_length_check
    check (char_length(btrim(display_name)) between 1 and 80),
  constraint league_players_nfl_team_format_check
    check (nfl_team ~ '^[A-Z]{2,3}$'),
  constraint league_players_unique_team
    unique (league_id, nfl_team)
);

create unique index league_players_one_active_commissioner
  on public.league_players (league_id)
  where role = 'commissioner' and status = 'active';

create unique index league_players_one_active_backup_commissioner
  on public.league_players (league_id)
  where role = 'backup_commissioner' and status = 'active';

create table public.account_links (
  id uuid primary key default extensions.gen_random_uuid(),
  league_id uuid not null,
  player_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  login_email text not null,
  active boolean not null default true,
  linked_by uuid references auth.users(id) on delete set null,
  linked_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint account_links_player_fk
    foreign key (league_id, player_id)
    references public.league_players(league_id, player_id)
    on delete cascade,
  constraint account_links_login_email_normalized_check
    check (login_email = lower(btrim(login_email))),
  constraint account_links_login_email_format_check
    check (login_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')
);

create unique index account_links_one_active_link_per_user
  on public.account_links (user_id)
  where active;

create unique index account_links_one_active_link_per_player
  on public.account_links (league_id, player_id)
  where active;

create table public.account_link_invitations (
  id uuid primary key default extensions.gen_random_uuid(),
  league_id uuid not null,
  player_id text not null,
  email text not null,
  status public.account_invitation_status not null default 'pending',
  expires_at timestamptz,
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  accepted_by uuid references auth.users(id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint account_link_invitations_player_fk
    foreign key (league_id, player_id)
    references public.league_players(league_id, player_id)
    on delete cascade,
  constraint account_link_invitations_email_normalized_check
    check (email = lower(btrim(email))),
  constraint account_link_invitations_email_format_check
    check (email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  constraint account_link_invitations_acceptance_check
    check (
      (status = 'accepted' and accepted_by is not null and accepted_at is not null)
      or
      (status <> 'accepted')
    )
);

create unique index account_link_invitations_one_pending_per_player
  on public.account_link_invitations (league_id, player_id)
  where status = 'pending';

create table public.league_games (
  league_id uuid not null references public.leagues(id) on delete cascade,
  game_id text not null,
  season integer not null,
  week smallint not null,
  away_team text not null,
  home_team text not null,
  kickoff_at timestamptz not null,
  status public.league_game_status not null default 'scheduled',
  away_score integer,
  home_score integer,
  winner_team text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (league_id, game_id),
  constraint league_games_game_id_length_check
    check (char_length(btrim(game_id)) between 1 and 120),
  constraint league_games_season_check
    check (season between 2000 and 2100),
  constraint league_games_week_check
    check (week between 1 and 18),
  constraint league_games_away_team_format_check
    check (away_team ~ '^[A-Z]{2,3}$'),
  constraint league_games_home_team_format_check
    check (home_team ~ '^[A-Z]{2,3}$'),
  constraint league_games_distinct_teams_check
    check (away_team <> home_team),
  constraint league_games_away_score_check
    check (away_score is null or away_score >= 0),
  constraint league_games_home_score_check
    check (home_score is null or home_score >= 0),
  constraint league_games_winner_team_check
    check (
      winner_team is null
      or winner_team = away_team
      or winner_team = home_team
    )
);

create index league_games_week_kickoff_index
  on public.league_games (league_id, week, kickoff_at);

create table public.league_documents (
  league_id uuid not null references public.leagues(id) on delete cascade,
  document_key text not null,
  visibility public.league_document_visibility not null default 'members',
  schema_version integer not null default 1,
  revision bigint not null default 1,
  payload jsonb not null default '{}'::jsonb,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (league_id, document_key),
  constraint league_documents_key_format_check
    check (document_key ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint league_documents_schema_version_check
    check (schema_version >= 1),
  constraint league_documents_revision_check
    check (revision >= 1),
  constraint league_documents_payload_object_check
    check (jsonb_typeof(payload) = 'object')
);

create table public.player_picks (
  league_id uuid not null,
  player_id text not null,
  game_id text not null,
  week smallint not null,
  selected_team text not null,
  source public.pick_source not null default 'player',
  submitted_at timestamptz,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  updated_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (league_id, player_id, game_id),
  constraint player_picks_player_fk
    foreign key (league_id, player_id)
    references public.league_players(league_id, player_id)
    on delete cascade,
  constraint player_picks_game_fk
    foreign key (league_id, game_id)
    references public.league_games(league_id, game_id)
    on delete cascade,
  constraint player_picks_week_check
    check (week between 1 and 18),
  constraint player_picks_selected_team_format_check
    check (selected_team ~ '^[A-Z]{2,3}$')
);

create index player_picks_player_week_index
  on public.player_picks (league_id, player_id, week);

create table public.weekly_pick_submissions (
  league_id uuid not null,
  player_id text not null,
  week smallint not null,
  submitted_at timestamptz not null default now(),
  reopened_at timestamptz,
  updated_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (league_id, player_id, week),
  constraint weekly_pick_submissions_player_fk
    foreign key (league_id, player_id)
    references public.league_players(league_id, player_id)
    on delete cascade,
  constraint weekly_pick_submissions_week_check
    check (week between 1 and 18),
  constraint weekly_pick_submissions_reopen_check
    check (reopened_at is null or reopened_at >= submitted_at)
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.bump_league_document_revision()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.revision = old.revision + 1;
  new.updated_at = now();
  new.updated_by = auth.uid();
  return new;
end;
$$;

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
begin
  select
    lower(btrim(users.email))
  into resolved_email
  from auth.users as users
  where users.id = new.user_id;

  if resolved_email is null or resolved_email = '' then
    raise exception 'The linked Supabase user must have an email address.';
  end if;

  select
    players.role,
    players.status
  into
    target_role,
    target_status
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
    if not coalesce(public.can_manage_accounts(new.league_id), false) then
      if not (
        public.can_bootstrap_league(new.league_id)
        and new.user_id = auth.uid()
        and target_role = 'commissioner'
        and target_status = 'active'
      ) then
        raise exception 'The initial account link must link the league creator to the active commissioner player.';
      end if;
    end if;

    new.linked_by := auth.uid();
  end if;

  new.login_email := resolved_email;
  return new;
end;
$$;

create or replace function public.current_league_role(
  target_league_id uuid
)
returns public.league_member_role
language sql
stable
security definer
set search_path = ''
as $$
  select players.role
  from public.account_links as links
  join public.league_players as players
    on players.league_id = links.league_id
   and players.player_id = links.player_id
  where links.league_id = target_league_id
    and links.user_id = auth.uid()
    and links.active
    and players.status = 'active'
  limit 1
$$;

create or replace function public.is_league_member(
  target_league_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.current_league_role(target_league_id) is not null
$$;

create or replace function public.can_manage_league(
  target_league_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    public.current_league_role(target_league_id)
      in ('commissioner', 'backup_commissioner'),
    false
  )
$$;

create or replace function public.can_manage_accounts(
  target_league_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    public.current_league_role(target_league_id) = 'commissioner',
    false
  )
$$;

create or replace function public.is_own_league_player(
  target_league_id uuid,
  target_player_id text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.account_links as links
    join public.league_players as players
      on players.league_id = links.league_id
     and players.player_id = links.player_id
    where links.league_id = target_league_id
      and links.player_id = target_player_id
      and links.user_id = auth.uid()
      and links.active
      and players.status = 'active'
  )
$$;

create or replace function public.can_bootstrap_league(
  target_league_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.leagues as leagues
    where leagues.id = target_league_id
      and leagues.created_by = auth.uid()
      and not exists (
        select 1
        from public.account_links as links
        join public.league_players as players
          on players.league_id = links.league_id
         and players.player_id = links.player_id
        where links.league_id = target_league_id
          and links.active
          and players.status = 'active'
          and players.role = 'commissioner'
      )
  )
$$;

create or replace function public.is_pick_open(
  target_league_id uuid,
  target_game_id text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select games.status = 'scheduled'
        and now() < (
          games.kickoff_at
          - make_interval(
              mins => leagues.pick_lock_minutes_before_kickoff::integer
            )
        )
      from public.league_games as games
      join public.leagues as leagues
        on leagues.id = games.league_id
      where games.league_id = target_league_id
        and games.game_id = target_game_id
    ),
    false
  )
$$;

create or replace function public.can_edit_player_pick(
  target_league_id uuid,
  target_player_id text,
  target_game_id text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.can_manage_league(target_league_id)
    or (
      public.is_own_league_player(
        target_league_id,
        target_player_id
      )
      and public.is_pick_open(
        target_league_id,
        target_game_id
      )
    )
$$;

create or replace function public.protect_league_player_roles()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_league_id uuid;
  old_role public.league_member_role;
  new_role public.league_member_role;
  old_status public.league_player_status;
  new_status public.league_player_status;
  has_account_authority boolean;
begin
  if tg_op = 'DELETE' then
    target_league_id := old.league_id;
    old_role := old.role;
    old_status := old.status;
    new_role := null;
    new_status := null;
  elsif tg_op = 'INSERT' then
    target_league_id := new.league_id;
    old_role := null;
    old_status := null;
    new_role := new.role;
    new_status := new.status;
  else
    target_league_id := new.league_id;
    old_role := old.role;
    old_status := old.status;
    new_role := new.role;
    new_status := new.status;
  end if;

  if auth.uid() is null then
    if tg_op = 'DELETE' then
      return old;
    end if;

    return new;
  end if;

  has_account_authority :=
    coalesce(public.can_manage_accounts(target_league_id), false)
    or coalesce(public.can_bootstrap_league(target_league_id), false);

  if tg_op = 'INSERT' and new_role <> 'player' then
    if not has_account_authority then
      raise exception 'Only the primary commissioner can assign commissioner roles.';
    end if;
  end if;

  if tg_op = 'UPDATE' then
    if (
      old_role is distinct from new_role
      or (
        old_status is distinct from new_status
        and (
          old_role in ('commissioner', 'backup_commissioner')
          or new_role in ('commissioner', 'backup_commissioner')
        )
      )
    ) and not has_account_authority then
      raise exception 'Only the primary commissioner can change commissioner roles or status.';
    end if;
  end if;

  if tg_op = 'DELETE'
    and old_role in ('commissioner', 'backup_commissioner')
    and not has_account_authority then
    raise exception 'Only the primary commissioner can remove commissioner accounts.';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

create or replace function public.validate_player_pick()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  game_week smallint;
  game_away_team text;
  game_home_team text;
begin
  select
    games.week,
    games.away_team,
    games.home_team
  into
    game_week,
    game_away_team,
    game_home_team
  from public.league_games as games
  where games.league_id = new.league_id
    and games.game_id = new.game_id;

  if not found then
    raise exception 'The pick must target an existing league game.';
  end if;

  if new.selected_team not in (game_away_team, game_home_team) then
    raise exception 'The selected team must be the home or away team for the game.';
  end if;

  new.week := game_week;

  if auth.uid() is not null then
    if not coalesce(public.can_manage_league(new.league_id), false)
      and new.source <> 'player' then
      raise exception 'Players may create only player-sourced picks.';
    end if;

    if tg_op = 'INSERT' then
      new.created_by := auth.uid();
    else
      new.created_by := old.created_by;
    end if;

    new.updated_by := auth.uid();
  end if;

  return new;
end;
$$;

create trigger leagues_set_updated_at
before update on public.leagues
for each row execute function public.set_updated_at();

create trigger league_players_set_updated_at
before update on public.league_players
for each row execute function public.set_updated_at();

create trigger league_players_protect_roles
before insert or update or delete on public.league_players
for each row execute function public.protect_league_player_roles();

create trigger account_links_validate
before insert or update on public.account_links
for each row execute function public.validate_account_link();

create trigger account_links_set_updated_at
before update on public.account_links
for each row execute function public.set_updated_at();

create trigger account_link_invitations_set_updated_at
before update on public.account_link_invitations
for each row execute function public.set_updated_at();

create trigger league_games_set_updated_at
before update on public.league_games
for each row execute function public.set_updated_at();

create trigger league_documents_bump_revision
before update on public.league_documents
for each row execute function public.bump_league_document_revision();

create trigger player_picks_set_updated_at
before update on public.player_picks
for each row execute function public.set_updated_at();

create trigger player_picks_validate
before insert or update on public.player_picks
for each row execute function public.validate_player_pick();

create trigger weekly_pick_submissions_set_updated_at
before update on public.weekly_pick_submissions
for each row execute function public.set_updated_at();

alter table public.leagues enable row level security;
alter table public.league_players enable row level security;
alter table public.account_links enable row level security;
alter table public.account_link_invitations enable row level security;
alter table public.league_games enable row level security;
alter table public.league_documents enable row level security;
alter table public.player_picks enable row level security;
alter table public.weekly_pick_submissions enable row level security;

create policy leagues_select_members
on public.leagues
for select
to authenticated
using (
  public.is_league_member(id)
  or public.can_bootstrap_league(id)
);

create policy leagues_insert_creator
on public.leagues
for insert
to authenticated
with check (created_by = auth.uid());

create policy leagues_update_managers
on public.leagues
for update
to authenticated
using (
  public.can_manage_league(id)
  or public.can_bootstrap_league(id)
)
with check (
  public.can_manage_league(id)
  or public.can_bootstrap_league(id)
);

create policy leagues_delete_managers
on public.leagues
for delete
to authenticated
using (
  public.can_manage_league(id)
  or public.can_bootstrap_league(id)
);

create policy league_players_select_members
on public.league_players
for select
to authenticated
using (
  public.is_league_member(league_id)
  or public.can_bootstrap_league(league_id)
);

create policy league_players_insert_managers
on public.league_players
for insert
to authenticated
with check (
  public.can_manage_league(league_id)
  or public.can_bootstrap_league(league_id)
);

create policy league_players_update_managers
on public.league_players
for update
to authenticated
using (
  public.can_manage_league(league_id)
  or public.can_bootstrap_league(league_id)
)
with check (
  public.can_manage_league(league_id)
  or public.can_bootstrap_league(league_id)
);

create policy league_players_delete_managers
on public.league_players
for delete
to authenticated
using (
  public.can_manage_league(league_id)
  or public.can_bootstrap_league(league_id)
);

create policy account_links_select_owner_or_commissioner
on public.account_links
for select
to authenticated
using (
  user_id = auth.uid()
  or public.can_manage_accounts(league_id)
  or public.can_bootstrap_league(league_id)
);

create policy account_links_insert_commissioner
on public.account_links
for insert
to authenticated
with check (
  public.can_manage_accounts(league_id)
  or public.can_bootstrap_league(league_id)
);

create policy account_links_update_commissioner
on public.account_links
for update
to authenticated
using (
  public.can_manage_accounts(league_id)
  or public.can_bootstrap_league(league_id)
)
with check (
  public.can_manage_accounts(league_id)
  or public.can_bootstrap_league(league_id)
);

create policy account_links_delete_commissioner
on public.account_links
for delete
to authenticated
using (
  public.can_manage_accounts(league_id)
  or public.can_bootstrap_league(league_id)
);

create policy account_link_invitations_select_commissioner
on public.account_link_invitations
for select
to authenticated
using (
  public.can_manage_accounts(league_id)
  or public.can_bootstrap_league(league_id)
);

create policy account_link_invitations_insert_commissioner
on public.account_link_invitations
for insert
to authenticated
with check (
  public.can_manage_accounts(league_id)
  or public.can_bootstrap_league(league_id)
);

create policy account_link_invitations_update_commissioner
on public.account_link_invitations
for update
to authenticated
using (
  public.can_manage_accounts(league_id)
  or public.can_bootstrap_league(league_id)
)
with check (
  public.can_manage_accounts(league_id)
  or public.can_bootstrap_league(league_id)
);

create policy account_link_invitations_delete_commissioner
on public.account_link_invitations
for delete
to authenticated
using (
  public.can_manage_accounts(league_id)
  or public.can_bootstrap_league(league_id)
);

create policy league_games_select_members
on public.league_games
for select
to authenticated
using (
  public.is_league_member(league_id)
  or public.can_bootstrap_league(league_id)
);

create policy league_games_insert_managers
on public.league_games
for insert
to authenticated
with check (
  public.can_manage_league(league_id)
  or public.can_bootstrap_league(league_id)
);

create policy league_games_update_managers
on public.league_games
for update
to authenticated
using (
  public.can_manage_league(league_id)
  or public.can_bootstrap_league(league_id)
)
with check (
  public.can_manage_league(league_id)
  or public.can_bootstrap_league(league_id)
);

create policy league_games_delete_managers
on public.league_games
for delete
to authenticated
using (
  public.can_manage_league(league_id)
  or public.can_bootstrap_league(league_id)
);

create policy league_documents_select_by_visibility
on public.league_documents
for select
to authenticated
using (
  (
    visibility = 'members'
    and public.is_league_member(league_id)
  )
  or
  (
    visibility = 'commissioners'
    and public.can_manage_league(league_id)
  )
  or public.can_bootstrap_league(league_id)
);

create policy league_documents_insert_managers
on public.league_documents
for insert
to authenticated
with check (
  public.can_manage_league(league_id)
  or public.can_bootstrap_league(league_id)
);

create policy league_documents_update_managers
on public.league_documents
for update
to authenticated
using (
  public.can_manage_league(league_id)
  or public.can_bootstrap_league(league_id)
)
with check (
  public.can_manage_league(league_id)
  or public.can_bootstrap_league(league_id)
);

create policy league_documents_delete_managers
on public.league_documents
for delete
to authenticated
using (
  public.can_manage_league(league_id)
  or public.can_bootstrap_league(league_id)
);

create policy player_picks_select_owner_or_manager
on public.player_picks
for select
to authenticated
using (
  public.is_own_league_player(league_id, player_id)
  or public.can_manage_league(league_id)
);

create policy player_picks_insert_owner_or_manager
on public.player_picks
for insert
to authenticated
with check (
  public.can_edit_player_pick(
    league_id,
    player_id,
    game_id
  )
);

create policy player_picks_update_owner_or_manager
on public.player_picks
for update
to authenticated
using (
  public.can_edit_player_pick(
    league_id,
    player_id,
    game_id
  )
)
with check (
  public.can_edit_player_pick(
    league_id,
    player_id,
    game_id
  )
);

create policy player_picks_delete_owner_or_manager
on public.player_picks
for delete
to authenticated
using (
  public.can_edit_player_pick(
    league_id,
    player_id,
    game_id
  )
);

create policy weekly_pick_submissions_select_owner_or_manager
on public.weekly_pick_submissions
for select
to authenticated
using (
  public.is_own_league_player(league_id, player_id)
  or public.can_manage_league(league_id)
);

create policy weekly_pick_submissions_insert_owner_or_manager
on public.weekly_pick_submissions
for insert
to authenticated
with check (
  public.is_own_league_player(league_id, player_id)
  or public.can_manage_league(league_id)
);

create policy weekly_pick_submissions_update_owner_or_manager
on public.weekly_pick_submissions
for update
to authenticated
using (
  public.is_own_league_player(league_id, player_id)
  or public.can_manage_league(league_id)
)
with check (
  public.is_own_league_player(league_id, player_id)
  or public.can_manage_league(league_id)
);

create policy weekly_pick_submissions_delete_owner_or_manager
on public.weekly_pick_submissions
for delete
to authenticated
using (
  public.is_own_league_player(league_id, player_id)
  or public.can_manage_league(league_id)
);

create view public.current_account_link
with (security_invoker = true)
as
select
  links.user_id,
  links.league_id,
  links.player_id,
  players.role,
  links.active,
  leagues.name as league_name,
  leagues.season,
  players.display_name as player_name,
  players.nfl_team
from public.account_links as links
join public.league_players as players
  on players.league_id = links.league_id
 and players.player_id = links.player_id
join public.leagues as leagues
  on leagues.id = links.league_id
where links.user_id = auth.uid()
  and links.active
  and players.status = 'active';

revoke all on table public.leagues from public, anon;
revoke all on table public.league_players from public, anon;
revoke all on table public.account_links from public, anon;
revoke all on table public.account_link_invitations from public, anon;
revoke all on table public.league_games from public, anon;
revoke all on table public.league_documents from public, anon;
revoke all on table public.player_picks from public, anon;
revoke all on table public.weekly_pick_submissions from public, anon;
revoke all on table public.current_account_link from public, anon;

grant select, insert, update, delete on table public.leagues to authenticated;
grant select, insert, update, delete on table public.league_players to authenticated;
grant select, insert, update, delete on table public.account_links to authenticated;
grant select, insert, update, delete on table public.account_link_invitations to authenticated;
grant select, insert, update, delete on table public.league_games to authenticated;
grant select, insert, update, delete on table public.league_documents to authenticated;
grant select, insert, update, delete on table public.player_picks to authenticated;
grant select, insert, update, delete on table public.weekly_pick_submissions to authenticated;
grant select on table public.current_account_link to authenticated;

grant usage on type public.league_status to authenticated;
grant usage on type public.league_member_role to authenticated;
grant usage on type public.league_player_status to authenticated;
grant usage on type public.league_game_status to authenticated;
grant usage on type public.league_document_visibility to authenticated;
grant usage on type public.pick_source to authenticated;
grant usage on type public.account_invitation_status to authenticated;

revoke all on function public.current_league_role(uuid) from public;
revoke all on function public.is_league_member(uuid) from public;
revoke all on function public.can_manage_league(uuid) from public;
revoke all on function public.can_manage_accounts(uuid) from public;
revoke all on function public.is_own_league_player(uuid, text) from public;
revoke all on function public.can_bootstrap_league(uuid) from public;
revoke all on function public.is_pick_open(uuid, text) from public;
revoke all on function public.can_edit_player_pick(uuid, text, text) from public;

grant execute on function public.current_league_role(uuid) to authenticated;
grant execute on function public.is_league_member(uuid) to authenticated;
grant execute on function public.can_manage_league(uuid) to authenticated;
grant execute on function public.can_manage_accounts(uuid) to authenticated;
grant execute on function public.is_own_league_player(uuid, text) to authenticated;
grant execute on function public.can_bootstrap_league(uuid) to authenticated;
grant execute on function public.is_pick_open(uuid, text) to authenticated;
grant execute on function public.can_edit_player_pick(uuid, text, text) to authenticated;

comment on table public.leagues is
  'Top-level Head2Head Brawlin league settings and season controls.';

comment on table public.league_players is
  'League roster. Player IDs preserve the existing React application IDs.';

comment on table public.account_links is
  'One active Supabase Auth user linked to one active league player.';

comment on table public.account_link_invitations is
  'Commissioner-managed invitation records. This table does not create Auth users or send email.';

comment on table public.league_games is
  'NFL games used for shared schedule data and database-enforced pick locking.';

comment on table public.league_documents is
  'Versioned JSON documents for runtime histories that are not yet fully normalized.';

comment on column public.league_documents.visibility is
  'Use members for shared scoring/playoff state and commissioners for payout or other restricted state.';

comment on table public.player_picks is
  'Protected player picks. Players can read and change only their own picks before the database lock time.';

comment on table public.weekly_pick_submissions is
  'Per-player weekly submission state for later controlled pick reveal workflows.';

comment on view public.current_account_link is
  'The signed-in user account link shaped for the React authentication context.';

commit;

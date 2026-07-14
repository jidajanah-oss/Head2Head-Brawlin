begin;

create temporary table h2h_2026_roster_recovery (
  player_id text primary key,
  display_name text not null,
  nfl_team text not null unique,
  role public.league_member_role not null,
  status public.league_player_status not null
) on commit drop;

insert into h2h_2026_roster_recovery (
  player_id,
  display_name,
  nfl_team,
  role,
  status
)
values
  ('9e78b7a8-0e8f-4217-b364-0e633f5ce25d', 'Jimbo', 'WAS', 'commissioner', 'active'),
  ('9a02b420-8bd2-4580-bff7-3ff911ea8e67', 'Bubba', 'BUF', 'player', 'active'),
  ('d2e54523-5188-46db-ba25-ed169cf1dd89', 'Jax', 'MIA', 'player', 'active'),
  ('a3c681d9-cf69-4367-bb29-e6090e4a0187', 'Chrissy', 'NE', 'player', 'active'),
  ('0c5bc67b-21ab-47ef-b71b-d958f998532b', 'Annarose', 'NYJ', 'player', 'active'),
  ('e46e82ce-6d80-4286-9683-3127a66235ac', 'Brandon', 'BAL', 'player', 'active'),
  ('9b334698-46a1-4122-a381-817a71449218', 'Brenton', 'CIN', 'player', 'active'),
  ('d09c5f02-bafb-42b9-bf64-2c41e382a946', 'Dot', 'CLE', 'player', 'active'),
  ('4b452cdc-c5c8-49f6-8424-84169478e386', 'Mike D', 'PIT', 'player', 'active'),
  ('28e53d97-bde2-4974-bf5a-69b0dbdbf339', 'G-Man', 'HOU', 'player', 'active'),
  ('d0064df5-3dbe-46db-b318-0b1304dd6d17', 'Tha-Tha', 'IND', 'player', 'active'),
  ('79e74e7f-622f-4b87-80d9-c70832911f7f', 'Tiereni', 'JAX', 'player', 'active'),
  ('103c77ef-6bf0-4d7f-a169-e38b59462a0f', 'Rich', 'TEN', 'player', 'active'),
  ('061f34a8-eff9-4931-85c5-bbf75a740e59', 'Zach', 'DEN', 'player', 'active'),
  ('ae01056c-02af-4d6b-93f8-2ddbae174569', 'Mark L', 'KC', 'player', 'active'),
  ('8f3b9e66-e48b-463e-8c03-65e87e0aa899', 'Tyler', 'LV', 'player', 'active'),
  ('2f84d52d-5da6-46f5-b21f-895bd0f401d8', 'Biggy B', 'LAC', 'player', 'active'),
  ('49934698-7b00-4e44-87f2-8c82f46f0d00', 'Ted', 'DAL', 'player', 'active'),
  ('92b43379-0778-415d-964e-7a4e50540480', 'Mark W', 'NYG', 'player', 'active'),
  ('336a228a-011c-4192-bb0a-bb2153b98507', 'Damian', 'PHI', 'player', 'active'),
  ('8570f458-07aa-4944-863f-99b4ff44c366', 'Christie', 'CHI', 'player', 'active'),
  ('0986beb3-ae92-4762-bc4d-235dc04e03bf', 'Joey', 'DET', 'player', 'active'),
  ('ffcbe8a2-1555-4d1b-a050-897e80b17f8a', 'Terry', 'GB', 'player', 'active'),
  ('ba1102a6-ab20-4b45-a843-b57a0c029066', 'Bruce Lee', 'MIN', 'backup_commissioner', 'active'),
  ('66730c9a-bc89-4440-ada3-9e69e19b9551', 'Larry O', 'ATL', 'player', 'active'),
  ('ce6c1201-8a1a-43d5-941d-307f62613908', 'Kenny', 'CAR', 'player', 'active'),
  ('fbb1fb87-b4c2-452b-9ce9-a18e650c830e', 'Alisha', 'NO', 'player', 'active'),
  ('719f5dd1-cd1a-44df-8c4d-af851eaab7a7', 'Vicky', 'TB', 'player', 'active'),
  ('af3f5223-443a-42f9-839b-137a0ad7f166', 'Danielle', 'ARI', 'player', 'active'),
  ('bbdf0723-0aef-4e6d-9d10-debffdbd8958', 'Erin', 'LAR', 'player', 'active'),
  ('784ebc34-f32f-485e-a5f3-0bf10013c2a8', 'Russ', 'SF', 'player', 'active'),
  ('41d1778a-7f08-4f2b-be68-21836bd5deed', 'Devin', 'SEA', 'player', 'active');

do $recovery$
declare
  target_league_id uuid;
  recovery_count integer;
  recovered_player_count integer;
  recovered_team_count integer;
  active_commissioner_count integer;
  active_backup_count integer;
  linked_count_before integer;
  linked_count_after integer;
begin
  select leagues.id
  into target_league_id
  from public.leagues as leagues
  where leagues.season = 2026
  order by
    case leagues.status
      when 'active' then 1
      when 'setup' then 2
      else 3
    end,
    leagues.created_at
  limit 1;

  if target_league_id is null then
    raise exception 'The 2026 league could not be found.';
  end if;

  select count(*)::integer
  into recovery_count
  from h2h_2026_roster_recovery;

  if recovery_count <> 32 then
    raise exception 'The recovery roster must contain exactly 32 players.';
  end if;

  if exists (
    select 1
    from public.account_links as links
    where links.league_id = target_league_id
      and links.active
      and not exists (
        select 1
        from h2h_2026_roster_recovery as recovery
        where recovery.player_id = links.player_id
      )
  ) then
    raise exception 'An active linked account targets a player outside the verified recovery roster.';
  end if;

  select count(*)::integer
  into linked_count_before
  from public.account_links as links
  where links.league_id = target_league_id
    and links.active;

  delete from public.league_players as players
  where players.league_id = target_league_id
    and not exists (
      select 1
      from h2h_2026_roster_recovery as recovery
      where recovery.player_id = players.player_id
    )
    and not exists (
      select 1
      from public.account_links as links
      where links.league_id = players.league_id
        and links.player_id = players.player_id
        and links.active
    );

  insert into public.league_players as players (
    league_id,
    player_id,
    display_name,
    nfl_team,
    role,
    status,
    custom_logo
  )
  select
    target_league_id,
    recovery.player_id,
    recovery.display_name,
    recovery.nfl_team,
    recovery.role,
    recovery.status,
    '/logos/franchises/' || recovery.nfl_team || '.png'
  from h2h_2026_roster_recovery as recovery
  on conflict (league_id, player_id)
  do update
  set
    display_name = excluded.display_name,
    nfl_team = excluded.nfl_team,
    role = excluded.role,
    status = excluded.status,
    custom_logo = coalesce(
      players.custom_logo,
      excluded.custom_logo
    ),
    updated_at = now();

  select
    count(*)::integer,
    count(distinct players.nfl_team)::integer,
    count(*) filter (
      where players.role = 'commissioner'
        and players.status = 'active'
    )::integer,
    count(*) filter (
      where players.role = 'backup_commissioner'
        and players.status = 'active'
    )::integer
  into
    recovered_player_count,
    recovered_team_count,
    active_commissioner_count,
    active_backup_count
  from public.league_players as players
  where players.league_id = target_league_id;

  if recovered_player_count <> 32 then
    raise exception 'Cloud roster recovery finished with % players instead of 32.',
      recovered_player_count;
  end if;

  if recovered_team_count <> 32 then
    raise exception 'Cloud roster recovery did not restore 32 unique NFL teams.';
  end if;

  if active_commissioner_count <> 1 then
    raise exception 'Cloud roster recovery must preserve exactly one active commissioner.';
  end if;

  if active_backup_count <> 1 then
    raise exception 'Cloud roster recovery must preserve exactly one active backup commissioner.';
  end if;

  select count(*)::integer
  into linked_count_after
  from public.account_links as links
  where links.league_id = target_league_id
    and links.active;

  if linked_count_after <> linked_count_before then
    raise exception 'Cloud roster recovery changed the active account-link count.';
  end if;
end;
$recovery$;

do $guard$
begin
  if to_regprocedure(
    'public.sync_current_league_roster_legacy(uuid,jsonb)'
  ) is null then
    alter function public.sync_current_league_roster(uuid, jsonb)
      rename to sync_current_league_roster_legacy;
  end if;
end;
$guard$;

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
  league_status public.league_status;
  league_max_players smallint;
  existing_player_count integer;
  payload_player_count integer;
begin
  if p_players is null
    or jsonb_typeof(p_players) is distinct from 'array'
  then
    raise exception 'The roster payload must be a JSON array.';
  end if;

  payload_player_count := jsonb_array_length(p_players);

  select
    leagues.status,
    leagues.max_players
  into
    league_status,
    league_max_players
  from public.leagues as leagues
  where leagues.id = p_league_id;

  if not found then
    raise exception 'The roster must target an existing league.';
  end if;

  select count(*)::integer
  into existing_player_count
  from public.league_players as players
  where players.league_id = p_league_id;

  if (
    league_status = 'active'
    and existing_player_count >= league_max_players
    and payload_player_count < league_max_players
  ) then
    raise exception 'A full active league cannot be synchronized with an incomplete roster.'
      using detail = format(
        'The cloud contains %s players and the incoming payload contains %s; %s are required.',
        existing_player_count,
        payload_player_count,
        league_max_players
      );
  end if;

  return public.sync_current_league_roster_legacy(
    p_league_id,
    p_players
  );
end;
$$;

revoke all on function public.sync_current_league_roster_legacy(uuid, jsonb)
  from public, authenticated;

revoke all on function public.sync_current_league_roster(uuid, jsonb)
  from public;

grant execute on function public.sync_current_league_roster(uuid, jsonb)
  to authenticated;

comment on function public.sync_current_league_roster(uuid, jsonb) is
  'Synchronizes the commissioner-managed roster and refuses to shrink a full active league to an incomplete payload.';

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
    9 as schema_version,
    'head2head-brawlin'::text as service,
    now() as checked_at
$$;

revoke all on function public.cloud_connection_status()
  from public;

grant execute on function public.cloud_connection_status()
  to anon, authenticated;

notify pgrst, 'reload schema';

commit;

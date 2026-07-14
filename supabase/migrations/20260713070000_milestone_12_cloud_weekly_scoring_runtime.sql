begin;

create table public.weekly_scoring_records (
  league_id uuid not null references public.leagues(id) on delete cascade,
  season integer not null,
  week smallint not null,
  record_id text not null,
  record_payload jsonb not null,
  finalized_at timestamptz not null,
  published_at timestamptz not null default now(),
  published_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (league_id, season, week),
  constraint weekly_scoring_records_record_id_unique
    unique (league_id, record_id),
  constraint weekly_scoring_records_season_check
    check (season between 2000 and 2100),
  constraint weekly_scoring_records_week_check
    check (week between 1 and 18),
  constraint weekly_scoring_records_record_id_check
    check (char_length(btrim(record_id)) between 1 and 120),
  constraint weekly_scoring_records_payload_object_check
    check (jsonb_typeof(record_payload) = 'object')
);

create index weekly_scoring_records_season_week_index
  on public.weekly_scoring_records (
    league_id,
    season,
    week
  );

alter table public.weekly_scoring_records
  enable row level security;

create policy weekly_scoring_records_select_members
  on public.weekly_scoring_records
  for select
  to authenticated
  using (
    public.is_league_member(league_id)
    or public.can_bootstrap_league(league_id)
  );

revoke all on table public.weekly_scoring_records
  from public, anon, authenticated;

grant select on table public.weekly_scoring_records
  to authenticated;

create or replace function public.publish_weekly_scoring_record(
  p_league_id uuid,
  p_season integer,
  p_week smallint,
  p_record_payload jsonb
)
returns table (
  league_id uuid,
  season integer,
  week smallint,
  record_payload jsonb,
  finalized_at timestamptz,
  published_at timestamptz,
  published_by uuid,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  expected_record_id text;
  league_season integer;
  total_game_count integer;
  final_game_count integer;
  canceled_game_count integer;
  pending_game_count integer;
  eligible_game_count integer;
  active_player_count integer;
  payload_finalized_at timestamptz;
begin
  if auth.uid() is null then
    raise exception 'A signed-in account is required to publish weekly scoring.';
  end if;

  if p_league_id is null then
    raise exception 'A league is required to publish weekly scoring.';
  end if;

  if not coalesce(
    public.can_manage_league(p_league_id),
    false
  ) then
    raise exception 'Only a commissioner can publish weekly scoring.';
  end if;

  if p_season is null
    or p_season not between 2000 and 2100
  then
    raise exception 'The scoring season must be between 2000 and 2100.';
  end if;

  if p_week is null or p_week not between 1 and 18 then
    raise exception 'The scoring week must be between 1 and 18.';
  end if;

  select leagues.season
  into league_season
  from public.leagues as leagues
  where leagues.id = p_league_id;

  if not found then
    raise exception 'The scoring record must target an existing league.';
  end if;

  if league_season <> p_season then
    raise exception 'The scoring season must match the active league season.';
  end if;

  if p_record_payload is null
    or jsonb_typeof(p_record_payload) is distinct from 'object'
  then
    raise exception 'The weekly scoring payload must be a JSON object.';
  end if;

  expected_record_id := format(
    '%s-week-%s',
    p_season,
    p_week
  );

  if coalesce(p_record_payload ->> 'id', '') <> expected_record_id then
    raise exception 'The weekly scoring payload contains the wrong record ID.';
  end if;

  if coalesce(p_record_payload ->> 'season', '') !~ '^[0-9]+$'
    or (p_record_payload ->> 'season')::integer <> p_season
  then
    raise exception 'The weekly scoring payload contains the wrong season.';
  end if;

  if coalesce(p_record_payload ->> 'week', '') !~ '^[0-9]+$'
    or (p_record_payload ->> 'week')::integer <> p_week
  then
    raise exception 'The weekly scoring payload contains the wrong week.';
  end if;

  begin
    payload_finalized_at :=
      (p_record_payload ->> 'finalizedAt')::timestamptz;
  exception
    when others then
      raise exception 'The weekly scoring payload contains an invalid finalized timestamp.';
  end;

  if jsonb_typeof(p_record_payload -> 'completedGameIds')
      is distinct from 'array'
    or jsonb_typeof(p_record_payload -> 'canceledGameIds')
      is distinct from 'array'
    or jsonb_typeof(p_record_payload -> 'matchups')
      is distinct from 'array'
    or jsonb_typeof(p_record_payload -> 'playerResults')
      is distinct from 'object'
  then
    raise exception 'The weekly scoring payload is missing required result collections.';
  end if;

  if coalesce(p_record_payload ->> 'totalScheduledGames', '')
      !~ '^[0-9]+$'
    or coalesce(p_record_payload ->> 'completedGameCount', '')
      !~ '^[0-9]+$'
    or coalesce(p_record_payload ->> 'canceledGameCount', '')
      !~ '^[0-9]+$'
    or coalesce(p_record_payload ->> 'eligibleScoringGameCount', '')
      !~ '^[0-9]+$'
  then
    raise exception 'The weekly scoring payload contains invalid game totals.';
  end if;

  select
    count(*)::integer,
    count(*) filter (
      where games.status = 'final'
    )::integer,
    count(*) filter (
      where games.status = 'canceled'
    )::integer,
    count(*) filter (
      where games.status in ('scheduled', 'live')
    )::integer,
    count(*) filter (
      where games.status = 'final'
        and games.away_score is not null
        and games.home_score is not null
        and games.away_score <> games.home_score
    )::integer
  into
    total_game_count,
    final_game_count,
    canceled_game_count,
    pending_game_count,
    eligible_game_count
  from public.league_games as games
  where games.league_id = p_league_id
    and games.season = p_season
    and games.week = p_week;

  if total_game_count = 0 then
    raise exception 'The cloud schedule is not ready for this week.';
  end if;

  if pending_game_count > 0 then
    raise exception 'The cloud schedule is not complete for this week.';
  end if;

  if exists (
    select 1
    from public.league_games as games
    where games.league_id = p_league_id
      and games.season = p_season
      and games.week = p_week
      and games.status = 'final'
      and (
        games.away_score is null
        or games.home_score is null
      )
  ) then
    raise exception 'Every final cloud game must contain both scores.';
  end if;

  if (p_record_payload ->> 'totalScheduledGames')::integer
      <> total_game_count
    or (p_record_payload ->> 'completedGameCount')::integer
      <> final_game_count
    or (p_record_payload ->> 'canceledGameCount')::integer
      <> canceled_game_count
    or (p_record_payload ->> 'eligibleScoringGameCount')::integer
      <> eligible_game_count
  then
    raise exception 'The weekly scoring payload does not match the completed cloud schedule.';
  end if;

  if jsonb_array_length(
    p_record_payload -> 'completedGameIds'
  ) <> final_game_count
    or jsonb_array_length(
      p_record_payload -> 'canceledGameIds'
    ) <> canceled_game_count
  then
    raise exception 'The weekly scoring game ID totals do not match the cloud schedule.';
  end if;

  select count(*)::integer
  into active_player_count
  from public.league_players as players
  where players.league_id = p_league_id
    and players.status = 'active';

  if active_player_count = 0 then
    raise exception 'The league has no active players to score.';
  end if;

  if jsonb_object_length(
    p_record_payload -> 'playerResults'
  ) <> active_player_count then
    raise exception 'The weekly scoring payload must contain every active player.';
  end if;

  if exists (
    select 1
    from public.league_players as players
    where players.league_id = p_league_id
      and players.status = 'active'
      and not (
        (p_record_payload -> 'playerResults')
        ? players.player_id
      )
  ) then
    raise exception 'The weekly scoring payload is missing an active player result.';
  end if;

  insert into public.weekly_scoring_records as records (
    league_id,
    season,
    week,
    record_id,
    record_payload,
    finalized_at,
    published_by
  )
  values (
    p_league_id,
    p_season,
    p_week,
    expected_record_id,
    p_record_payload,
    payload_finalized_at,
    auth.uid()
  )
  on conflict on constraint weekly_scoring_records_pkey
  do nothing;

  return query
  select
    records.league_id,
    records.season,
    records.week,
    records.record_payload,
    records.finalized_at,
    records.published_at,
    records.published_by,
    records.created_at
  from public.weekly_scoring_records as records
  where records.league_id = p_league_id
    and records.season = p_season
    and records.week = p_week;
end;
$$;

revoke all on function public.publish_weekly_scoring_record(
  uuid,
  integer,
  smallint,
  jsonb
) from public;

grant execute on function public.publish_weekly_scoring_record(
  uuid,
  integer,
  smallint,
  jsonb
) to authenticated;

comment on table public.weekly_scoring_records is
  'Immutable cloud-authoritative finalized weekly H2H scoring records used to hydrate season standings for every linked league member.';

comment on function public.publish_weekly_scoring_record(
  uuid,
  integer,
  smallint,
  jsonb
) is
  'Publishes one immutable completed-week scoring record. Concurrent commissioner attempts converge on the existing cloud record.';

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
    10 as schema_version,
    'head2head-brawlin'::text as service,
    now() as checked_at
$$;

revoke all on function public.cloud_connection_status()
  from public;

grant execute on function public.cloud_connection_status()
  to anon, authenticated;

notify pgrst, 'reload schema';

commit;

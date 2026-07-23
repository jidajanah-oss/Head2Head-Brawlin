begin;

create or replace function
public.create_picker_clicker_week_assignment(
  target_league_id uuid,
  target_season integer,
  target_week smallint,
  target_source_player_id text,
  target_cycle_number integer,
  target_assigned_at timestamptz
)
returns table (
  league_id uuid,
  season integer,
  week smallint,
  source_player_id text,
  source_player_name text,
  source_nfl_team text,
  cycle_number integer,
  assigned_at timestamptz,
  created_at timestamptz,
  created boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_source_player_id text :=
    nullif(
      btrim(target_source_player_id),
      ''
    );
  actor_role public.league_member_role;
  league_season integer;
  existing_assignment
    public.picker_clicker_week_assignments%rowtype;
  inserted_assignment
    public.picker_clicker_week_assignments%rowtype;
begin
  if auth.uid() is null then
    raise exception
      'Authentication is required to create the weekly Picker Clicker assignment.';
  end if;

  if target_league_id is null then
    raise exception
      'A league is required to create the weekly Picker Clicker assignment.';
  end if;

  if target_season is null
    or target_season not between 2000 and 2100 then
    raise exception
      'The Picker Clicker season must be between 2000 and 2100.';
  end if;

  if target_week is null
    or target_week not between 1 and 18 then
    raise exception
      'The Picker Clicker week must be between 1 and 18.';
  end if;

  if normalized_source_player_id is null then
    raise exception
      'A Picker Clicker source player is required.';
  end if;

  if target_cycle_number is null
    or target_cycle_number < 1 then
    raise exception
      'The Picker Clicker cycle number must be positive.';
  end if;

  select players.role
  into actor_role
  from public.account_links as links
  join public.league_players as players
    on players.league_id = links.league_id
   and players.player_id = links.player_id
  where links.league_id =
      target_league_id
    and links.user_id = auth.uid()
    and links.active
    and players.status = 'active'
  limit 1;

  if not found
    or actor_role not in (
      'commissioner',
      'backup_commissioner'
    ) then
    raise exception
      'Only a commissioner can create the weekly Picker Clicker assignment.';
  end if;

  select leagues.season
  into league_season
  from public.leagues as leagues
  where leagues.id = target_league_id;

  if not found then
    raise exception
      'The Picker Clicker assignment must target an existing league.';
  end if;

  if league_season <> target_season then
    raise exception
      'The Picker Clicker assignment season must match the active league season.';
  end if;

  if not exists (
    select 1
    from public.league_players as players
    where players.league_id =
        target_league_id
      and players.player_id =
        normalized_source_player_id
      and players.status = 'active'
  ) then
    raise exception
      'The Picker Clicker source must be an active league player.';
  end if;

  select assignments.*
  into existing_assignment
  from
    public.picker_clicker_week_assignments
      as assignments
  where assignments.league_id =
      target_league_id
    and assignments.season =
      target_season
    and assignments.week =
      target_week;

  if found then
    return query
    select
      existing_assignment.league_id,
      existing_assignment.season,
      existing_assignment.week,
      existing_assignment.source_player_id,
      existing_assignment.source_player_name,
      existing_assignment.source_nfl_team,
      existing_assignment.cycle_number,
      existing_assignment.assigned_at,
      existing_assignment.created_at,
      false;

    return;
  end if;

  insert into
    public.picker_clicker_week_assignments (
      league_id,
      season,
      week,
      source_player_id,
      source_player_name,
      source_nfl_team,
      cycle_number,
      assigned_at,
      created_by
    )
  values (
    target_league_id,
    target_season,
    target_week,
    normalized_source_player_id,
    'pending',
    'NFL',
    target_cycle_number,
    coalesce(
      target_assigned_at,
      now()
    ),
    auth.uid()
  )
  on conflict on constraint
    picker_clicker_week_assignments_pkey
  do nothing
  returning *
  into inserted_assignment;

  if inserted_assignment.league_id
    is not null then
    return query
    select
      inserted_assignment.league_id,
      inserted_assignment.season,
      inserted_assignment.week,
      inserted_assignment.source_player_id,
      inserted_assignment.source_player_name,
      inserted_assignment.source_nfl_team,
      inserted_assignment.cycle_number,
      inserted_assignment.assigned_at,
      inserted_assignment.created_at,
      true;

    return;
  end if;

  select assignments.*
  into existing_assignment
  from
    public.picker_clicker_week_assignments
      as assignments
  where assignments.league_id =
      target_league_id
    and assignments.season =
      target_season
    and assignments.week =
      target_week;

  if not found then
    raise exception
      'The weekly Picker Clicker assignment could not be created or recovered.';
  end if;

  return query
  select
    existing_assignment.league_id,
    existing_assignment.season,
    existing_assignment.week,
    existing_assignment.source_player_id,
    existing_assignment.source_player_name,
    existing_assignment.source_nfl_team,
    existing_assignment.cycle_number,
    existing_assignment.assigned_at,
    existing_assignment.created_at,
    false;
end;
$$;

revoke all on function
public.create_picker_clicker_week_assignment(
  uuid,
  integer,
  smallint,
  text,
  integer,
  timestamptz
)
from public, anon;

grant execute on function
public.create_picker_clicker_week_assignment(
  uuid,
  integer,
  smallint,
  text,
  integer,
  timestamptz
)
to authenticated;

create or replace function
public.reopen_weekly_submission_on_pick_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed_league_id uuid;
  changed_player_id text;
  changed_week smallint;
begin
  if tg_op = 'UPDATE'
    and old.selected_team
      is not distinct from
        new.selected_team
    and old.source
      is not distinct from
        new.source
    and old.picker_clicker_source_player_id
      is not distinct from
        new.picker_clicker_source_player_id then
    return new;
  end if;

  if tg_op = 'DELETE' then
    changed_league_id :=
      old.league_id;
    changed_player_id :=
      old.player_id;
    changed_week :=
      old.week;
  else
    changed_league_id :=
      new.league_id;
    changed_player_id :=
      new.player_id;
    changed_week :=
      new.week;
  end if;

  update public.weekly_pick_submissions
    as submissions
  set
    reopened_at = now(),
    updated_by = coalesce(
      auth.uid(),
      submissions.updated_by
    )
  where submissions.league_id =
      changed_league_id
    and submissions.player_id =
      changed_player_id
    and submissions.week =
      changed_week
    and submissions.reopened_at
      is null;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

drop trigger if exists
player_picks_reopen_weekly_submission
on public.player_picks;

create trigger
player_picks_reopen_weekly_submission
after insert
or delete
or update of
  selected_team,
  source,
  picker_clicker_source_player_id
on public.player_picks
for each row
execute function
public.reopen_weekly_submission_on_pick_change();

update public.weekly_pick_submissions
  as submissions
set
  reopened_at = now()
from public.leagues as leagues
where submissions.league_id =
    leagues.id
  and submissions.week =
    leagues.current_week
  and submissions.reopened_at
    is null
  and exists (
    select 1
    from public.league_games as games
    where games.league_id =
        submissions.league_id
      and games.season =
        leagues.season
      and games.week =
        submissions.week
      and public.is_pick_open(
        submissions.league_id,
        games.game_id
      )
      and not exists (
        select 1
        from public.player_picks as picks
        where picks.league_id =
            submissions.league_id
          and picks.player_id =
            submissions.player_id
          and picks.game_id =
            games.game_id
          and picks.week =
            submissions.week
      )
  );

comment on function
public.create_picker_clicker_week_assignment(
  uuid,
  integer,
  smallint,
  text,
  integer,
  timestamptz
)
is
  'Creates or returns the single cloud-authoritative weekly Picker Clicker assignment after protected commissioner-role validation.';

comment on function
public.reopen_weekly_submission_on_pick_change()
is
  'Automatically reopens a submitted weekly entry whenever its deliberate cloud pick choices are inserted, changed, or removed.';

notify pgrst, 'reload schema';

commit;

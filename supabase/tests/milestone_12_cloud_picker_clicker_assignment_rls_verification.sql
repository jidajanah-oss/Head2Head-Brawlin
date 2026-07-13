-- Head2Head Brawlin' - Cloud Picker Clicker Assignment Foundation v1 RLS verification
--
-- Requirements:
--   * One linked active commissioner account.
--   * At least four additional active ordinary league players.
--
-- This works when only Jimbo is linked. The existing commissioner link is
-- temporarily pointed at an unlinked ordinary player inside one transaction.
-- No invitation is created, no email is sent, and all test changes are removed
-- by the final ROLLBACK.

begin;

create temporary table cloud_pc_assignment_test_context (
  league_id uuid not null,
  commissioner_link_id uuid not null,
  commissioner_user_id uuid not null,
  commissioner_player_id text not null,
  ordinary_player_id text not null,
  source_player_id text not null,
  source_player_name text not null,
  source_nfl_team text not null,
  alternate_source_player_id text not null,
  alternate_source_player_name text not null,
  alternate_source_nfl_team text not null,
  inactive_source_player_id text not null,
  season integer not null,
  primary_week smallint not null,
  secondary_week smallint not null,
  tertiary_week smallint not null,
  test_cycle integer not null
) on commit drop;

with commissioner_account as (
  select
    links.id as account_link_id,
    links.league_id,
    links.user_id,
    links.player_id
  from public.account_links as links
  join public.league_players as players
    on players.league_id = links.league_id
   and players.player_id = links.player_id
  where links.active
    and players.status = 'active'
    and players.role = 'commissioner'
  order by links.linked_at
  limit 1
),
ordinary_player as (
  select
    players.league_id,
    players.player_id
  from public.league_players as players
  join commissioner_account as commissioner
    on commissioner.league_id = players.league_id
  where players.status = 'active'
    and players.role = 'player'
    and not exists (
      select 1
      from public.account_links as links
      where links.league_id = players.league_id
        and links.player_id = players.player_id
        and links.active
    )
  order by players.player_id
  limit 1
),
source_player as (
  select
    players.league_id,
    players.player_id,
    players.display_name,
    players.nfl_team
  from public.league_players as players
  join ordinary_player as ordinary
    on ordinary.league_id = players.league_id
  where players.status = 'active'
    and players.role = 'player'
    and players.player_id <> ordinary.player_id
  order by players.player_id
  limit 1
),
alternate_source_player as (
  select
    players.league_id,
    players.player_id,
    players.display_name,
    players.nfl_team
  from public.league_players as players
  join ordinary_player as ordinary
    on ordinary.league_id = players.league_id
  join source_player as source
    on source.league_id = players.league_id
  where players.status = 'active'
    and players.role = 'player'
    and players.player_id not in (
      ordinary.player_id,
      source.player_id
    )
  order by players.player_id
  limit 1
),
inactive_source_player as (
  select
    players.league_id,
    players.player_id
  from public.league_players as players
  join ordinary_player as ordinary
    on ordinary.league_id = players.league_id
  join source_player as source
    on source.league_id = players.league_id
  join alternate_source_player as alternate
    on alternate.league_id = players.league_id
  where players.status = 'active'
    and players.role = 'player'
    and players.player_id not in (
      ordinary.player_id,
      source.player_id,
      alternate.player_id
    )
  order by players.player_id
  limit 1
)
insert into cloud_pc_assignment_test_context (
  league_id,
  commissioner_link_id,
  commissioner_user_id,
  commissioner_player_id,
  ordinary_player_id,
  source_player_id,
  source_player_name,
  source_nfl_team,
  alternate_source_player_id,
  alternate_source_player_name,
  alternate_source_nfl_team,
  inactive_source_player_id,
  season,
  primary_week,
  secondary_week,
  tertiary_week,
  test_cycle
)
select
  commissioner.league_id,
  commissioner.account_link_id,
  commissioner.user_id,
  commissioner.player_id,
  ordinary.player_id,
  source.player_id,
  source.display_name,
  source.nfl_team,
  alternate.player_id,
  alternate.display_name,
  alternate.nfl_team,
  inactive.player_id,
  leagues.season,
  leagues.current_week::smallint,
  ((leagues.current_week % 18) + 1)::smallint,
  (((leagues.current_week + 1) % 18) + 1)::smallint,
  900000000 + (pg_backend_pid() % 1000000)
from commissioner_account as commissioner
join ordinary_player as ordinary
  on ordinary.league_id = commissioner.league_id
join source_player as source
  on source.league_id = commissioner.league_id
join alternate_source_player as alternate
  on alternate.league_id = commissioner.league_id
join inactive_source_player as inactive
  on inactive.league_id = commissioner.league_id
join public.leagues as leagues
  on leagues.id = commissioner.league_id;

do $test_context$
begin
  if not exists (
    select 1
    from cloud_pc_assignment_test_context
  ) then
    raise exception using message =
      'RLS verification requires one linked active commissioner and at least four additional active ordinary players in the same league.';
  end if;
end;
$test_context$;

create temporary table cloud_pc_assignment_test_results (
  test_name text not null,
  passed boolean not null,
  detail text not null
) on commit drop;

grant select on table cloud_pc_assignment_test_context
to authenticated;

grant select, insert on table cloud_pc_assignment_test_results
to authenticated;

delete from public.picker_clicker_week_assignments
using cloud_pc_assignment_test_context as context
where picker_clicker_week_assignments.league_id =
    context.league_id
  and picker_clicker_week_assignments.season =
    context.season
  and picker_clicker_week_assignments.week in (
    context.primary_week,
    context.secondary_week,
    context.tertiary_week
  );

update public.league_players as players
set status = 'inactive'
from cloud_pc_assignment_test_context as context
where players.league_id = context.league_id
  and players.player_id = context.inactive_source_player_id;

set local role authenticated;

select set_config(
  'request.jwt.claim.sub',
  context.commissioner_user_id::text,
  true
)
from cloud_pc_assignment_test_context as context;

select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', context.commissioner_user_id::text,
    'role', 'authenticated'
  )::text,
  true
)
from cloud_pc_assignment_test_context as context;

insert into public.picker_clicker_week_assignments (
  league_id,
  season,
  week,
  source_player_id,
  source_player_name,
  source_nfl_team,
  cycle_number,
  assigned_at
)
select
  context.league_id,
  context.season,
  context.primary_week,
  context.source_player_id,
  'spoofed',
  'NFL',
  context.test_cycle,
  now()
from cloud_pc_assignment_test_context as context;

insert into cloud_pc_assignment_test_results
  (test_name, passed, detail)
values (
  'Commissioner may create the authoritative assignment',
  true,
  'The linked commissioner inserted one weekly source assignment.'
);

insert into cloud_pc_assignment_test_results
  (test_name, passed, detail)
select
  'Database captures the roster source snapshot',
  count(*) = 1,
  case
    when count(*) = 1 then
      'Spoofed snapshot values were replaced with the roster name and NFL team.'
    else
      'The source snapshot did not match the active roster.'
  end
from public.picker_clicker_week_assignments as assignments
join cloud_pc_assignment_test_context as context
  on context.league_id = assignments.league_id
where assignments.season = context.season
  and assignments.week = context.primary_week
  and assignments.source_player_name = context.source_player_name
  and assignments.source_nfl_team =
    upper(context.source_nfl_team);

do $duplicate_week_test$
declare
  context_row cloud_pc_assignment_test_context%rowtype;
begin
  select * into context_row
  from cloud_pc_assignment_test_context;

  begin
    insert into public.picker_clicker_week_assignments (
      league_id,
      season,
      week,
      source_player_id,
      source_player_name,
      source_nfl_team,
      cycle_number
    )
    values (
      context_row.league_id,
      context_row.season,
      context_row.primary_week,
      context_row.alternate_source_player_id,
      'ignored',
      'NFL',
      context_row.test_cycle
    );

    insert into cloud_pc_assignment_test_results
      (test_name, passed, detail)
    values (
      'A league week cannot receive a second assignment',
      false,
      'The duplicate week unexpectedly accepted another source.'
    );
  exception
    when unique_violation then
      insert into cloud_pc_assignment_test_results
        (test_name, passed, detail)
      values (
        'A league week cannot receive a second assignment',
        true,
        sqlerrm
      );
  end;
end;
$duplicate_week_test$;

do $cycle_repeat_test$
declare
  context_row cloud_pc_assignment_test_context%rowtype;
begin
  select * into context_row
  from cloud_pc_assignment_test_context;

  begin
    insert into public.picker_clicker_week_assignments (
      league_id,
      season,
      week,
      source_player_id,
      source_player_name,
      source_nfl_team,
      cycle_number
    )
    values (
      context_row.league_id,
      context_row.season,
      context_row.secondary_week,
      context_row.source_player_id,
      'ignored',
      'NFL',
      context_row.test_cycle
    );

    insert into cloud_pc_assignment_test_results
      (test_name, passed, detail)
    values (
      'A source cannot repeat within one cycle',
      false,
      'The same source was unexpectedly reused in the same cycle.'
    );
  exception
    when unique_violation then
      insert into cloud_pc_assignment_test_results
        (test_name, passed, detail)
      values (
        'A source cannot repeat within one cycle',
        true,
        sqlerrm
      );
  end;
end;
$cycle_repeat_test$;

insert into public.picker_clicker_week_assignments (
  league_id,
  season,
  week,
  source_player_id,
  source_player_name,
  source_nfl_team,
  cycle_number
)
select
  context.league_id,
  context.season,
  context.secondary_week,
  context.alternate_source_player_id,
  'ignored',
  'NFL',
  context.test_cycle
from cloud_pc_assignment_test_context as context;

insert into cloud_pc_assignment_test_results
  (test_name, passed, detail)
values (
  'A different source may be used in the same cycle',
  true,
  'The alternate active source was accepted for another week.'
);

do $inactive_source_test$
declare
  context_row cloud_pc_assignment_test_context%rowtype;
begin
  select * into context_row
  from cloud_pc_assignment_test_context;

  begin
    insert into public.picker_clicker_week_assignments (
      league_id,
      season,
      week,
      source_player_id,
      source_player_name,
      source_nfl_team,
      cycle_number
    )
    values (
      context_row.league_id,
      context_row.season,
      context_row.tertiary_week,
      context_row.inactive_source_player_id,
      'ignored',
      'NFL',
      context_row.test_cycle + 1
    );

    insert into cloud_pc_assignment_test_results
      (test_name, passed, detail)
    values (
      'Inactive source player is rejected',
      false,
      'The inactive source assignment unexpectedly succeeded.'
    );
  exception
    when others then
      insert into cloud_pc_assignment_test_results
        (test_name, passed, detail)
      values (
        'Inactive source player is rejected',
        true,
        sqlerrm
      );
  end;
end;
$inactive_source_test$;

do $season_mismatch_test$
declare
  context_row cloud_pc_assignment_test_context%rowtype;
begin
  select * into context_row
  from cloud_pc_assignment_test_context;

  begin
    insert into public.picker_clicker_week_assignments (
      league_id,
      season,
      week,
      source_player_id,
      source_player_name,
      source_nfl_team,
      cycle_number
    )
    values (
      context_row.league_id,
      context_row.season + 1,
      context_row.tertiary_week,
      context_row.source_player_id,
      'ignored',
      'NFL',
      context_row.test_cycle + 1
    );

    insert into cloud_pc_assignment_test_results
      (test_name, passed, detail)
    values (
      'Assignment season mismatch is rejected',
      false,
      'A non-live season assignment unexpectedly succeeded.'
    );
  exception
    when others then
      insert into cloud_pc_assignment_test_results
        (test_name, passed, detail)
      values (
        'Assignment season mismatch is rejected',
        true,
        sqlerrm
      );
  end;
end;
$season_mismatch_test$;

reset role;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '{}', true);

update public.account_links as links
set player_id = context.ordinary_player_id
from cloud_pc_assignment_test_context as context
where links.id = context.commissioner_link_id;

set local role authenticated;

select set_config(
  'request.jwt.claim.sub',
  context.commissioner_user_id::text,
  true
)
from cloud_pc_assignment_test_context as context;

select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', context.commissioner_user_id::text,
    'role', 'authenticated'
  )::text,
  true
)
from cloud_pc_assignment_test_context as context;

insert into cloud_pc_assignment_test_results
  (test_name, passed, detail)
select
  'Ordinary league member may read shared assignments',
  count(*) = 2,
  case
    when count(*) = 2 then
      'The linked ordinary player read both shared test assignments.'
    else
      'The ordinary player did not see the expected assignments.'
  end
from public.picker_clicker_week_assignments as assignments
join cloud_pc_assignment_test_context as context
  on context.league_id = assignments.league_id
where assignments.season = context.season
  and assignments.week in (
    context.primary_week,
    context.secondary_week
  );

do $ordinary_insert_test$
declare
  context_row cloud_pc_assignment_test_context%rowtype;
begin
  select * into context_row
  from cloud_pc_assignment_test_context;

  begin
    insert into public.picker_clicker_week_assignments (
      league_id,
      season,
      week,
      source_player_id,
      source_player_name,
      source_nfl_team,
      cycle_number
    )
    values (
      context_row.league_id,
      context_row.season,
      context_row.tertiary_week,
      context_row.source_player_id,
      'ignored',
      'NFL',
      context_row.test_cycle + 1
    );

    insert into cloud_pc_assignment_test_results
      (test_name, passed, detail)
    values (
      'Ordinary player cannot create an assignment',
      false,
      'The ordinary-player insert unexpectedly succeeded.'
    );
  exception
    when others then
      insert into cloud_pc_assignment_test_results
        (test_name, passed, detail)
      values (
        'Ordinary player cannot create an assignment',
        true,
        sqlerrm
      );
  end;
end;
$ordinary_insert_test$;

do $ordinary_update_test$
begin
  begin
    update public.picker_clicker_week_assignments
    set cycle_number = cycle_number + 1;

    insert into cloud_pc_assignment_test_results
      (test_name, passed, detail)
    values (
      'Ordinary player cannot update an assignment',
      false,
      'The ordinary-player update unexpectedly succeeded.'
    );
  exception
    when others then
      insert into cloud_pc_assignment_test_results
        (test_name, passed, detail)
      values (
        'Ordinary player cannot update an assignment',
        true,
        sqlerrm
      );
  end;
end;
$ordinary_update_test$;

do $ordinary_delete_test$
begin
  begin
    delete from public.picker_clicker_week_assignments;

    insert into cloud_pc_assignment_test_results
      (test_name, passed, detail)
    values (
      'Ordinary player cannot delete an assignment',
      false,
      'The ordinary-player delete unexpectedly succeeded.'
    );
  exception
    when others then
      insert into cloud_pc_assignment_test_results
        (test_name, passed, detail)
      values (
        'Ordinary player cannot delete an assignment',
        true,
        sqlerrm
      );
  end;
end;
$ordinary_delete_test$;

reset role;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '{}', true);

update public.account_links as links
set player_id = context.commissioner_player_id
from cloud_pc_assignment_test_context as context
where links.id = context.commissioner_link_id;

set local role authenticated;

select set_config(
  'request.jwt.claim.sub',
  context.commissioner_user_id::text,
  true
)
from cloud_pc_assignment_test_context as context;

select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', context.commissioner_user_id::text,
    'role', 'authenticated'
  )::text,
  true
)
from cloud_pc_assignment_test_context as context;

do $commissioner_update_test$
begin
  begin
    update public.picker_clicker_week_assignments
    set cycle_number = cycle_number + 1;

    insert into cloud_pc_assignment_test_results
      (test_name, passed, detail)
    values (
      'Commissioner cannot rewrite an assignment',
      false,
      'The immutable assignment was unexpectedly updated.'
    );
  exception
    when others then
      insert into cloud_pc_assignment_test_results
        (test_name, passed, detail)
      values (
        'Commissioner cannot rewrite an assignment',
        true,
        sqlerrm
      );
  end;
end;
$commissioner_update_test$;

do $commissioner_delete_test$
begin
  begin
    delete from public.picker_clicker_week_assignments;

    insert into cloud_pc_assignment_test_results
      (test_name, passed, detail)
    values (
      'Commissioner cannot delete an assignment',
      false,
      'The immutable assignment was unexpectedly deleted.'
    );
  exception
    when others then
      insert into cloud_pc_assignment_test_results
        (test_name, passed, detail)
      values (
        'Commissioner cannot delete an assignment',
        true,
        sqlerrm
      );
  end;
end;
$commissioner_delete_test$;

reset role;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '{}', true);

select
  test_name,
  passed,
  detail
from cloud_pc_assignment_test_results
order by test_name;

select
  count(*) as test_count,
  count(*) filter (where passed) as passed_count,
  count(*) filter (where not passed) as failed_count,
  coalesce(bool_and(passed), false) as all_rls_tests_passed,
  coalesce(
    string_agg(
      test_name || ': ' || detail,
      E'\n'
      order by test_name
    ) filter (where not passed),
    'none'
  ) as failed_test_details
from cloud_pc_assignment_test_results;

rollback;

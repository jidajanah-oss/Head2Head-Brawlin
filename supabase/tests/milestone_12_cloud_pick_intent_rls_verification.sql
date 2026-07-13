-- Head2Head Brawlin' - Cloud Pick Intent Foundation v1 RLS verification
--
-- Run the entire file in the Supabase SQL Editor after the foundation
-- migration and structural verification pass.
--
-- Requirements:
--   * One linked active commissioner account.
--   * At least three additional active ordinary league players.
--
-- This version works even when only the commissioner account is linked.
-- Inside one rollback-only transaction, it temporarily points the existing
-- commissioner account link at an unlinked ordinary player to exercise the
-- ordinary-player RLS path, then points it back for commissioner checks.
-- No invitation is created, no email is sent, and no account-link or roster
-- change survives the final ROLLBACK.

begin;

create temporary table cloud_pick_intent_test_context (
  league_id uuid not null,
  commissioner_link_id uuid not null,
  commissioner_user_id uuid not null,
  commissioner_player_id text not null,
  ordinary_player_id text not null,
  source_player_id text not null,
  protected_player_id text not null,
  season integer not null,
  week smallint not null,
  away_team text not null,
  home_team text not null,
  manual_game_id text not null,
  picker_clicker_game_id text not null,
  locked_game_id text not null
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
    players.player_id,
    players.nfl_team
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
protected_player as (
  select
    players.league_id,
    players.player_id
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
)
insert into cloud_pick_intent_test_context (
  league_id,
  commissioner_link_id,
  commissioner_user_id,
  commissioner_player_id,
  ordinary_player_id,
  source_player_id,
  protected_player_id,
  season,
  week,
  away_team,
  home_team,
  manual_game_id,
  picker_clicker_game_id,
  locked_game_id
)
select
  commissioner.league_id,
  commissioner.account_link_id,
  commissioner.user_id,
  commissioner.player_id,
  ordinary.player_id,
  source.player_id,
  protected.player_id,
  leagues.season,
  leagues.current_week,
  ordinary.nfl_team,
  source.nfl_team,
  concat(
    'cloud-pick-intent-test-',
    pg_backend_pid(),
    '-manual'
  ),
  concat(
    'cloud-pick-intent-test-',
    pg_backend_pid(),
    '-pc'
  ),
  concat(
    'cloud-pick-intent-test-',
    pg_backend_pid(),
    '-locked'
  )
from commissioner_account as commissioner
join ordinary_player as ordinary
  on ordinary.league_id = commissioner.league_id
join source_player as source
  on source.league_id = commissioner.league_id
join protected_player as protected
  on protected.league_id = commissioner.league_id
join public.leagues as leagues
  on leagues.id = commissioner.league_id;

do $test_context$
begin
  if not exists (
    select 1
    from cloud_pick_intent_test_context
  ) then
    raise exception using message =
      'RLS verification requires one linked active commissioner and at least three additional active ordinary players in the same league.';
  end if;
end;
$test_context$;

create temporary table cloud_pick_intent_test_results (
  test_name text not null,
  passed boolean not null,
  detail text not null
) on commit drop;

grant select on table cloud_pick_intent_test_context
to authenticated;

grant select, insert on table cloud_pick_intent_test_results
to authenticated;

insert into public.league_games (
  league_id,
  game_id,
  season,
  week,
  away_team,
  home_team,
  kickoff_at,
  status
)
select
  context.league_id,
  games.game_id,
  context.season,
  context.week,
  context.away_team,
  context.home_team,
  games.kickoff_at,
  'scheduled'::public.league_game_status
from cloud_pick_intent_test_context as context
cross join lateral (
  values
    (
      context.manual_game_id,
      now() + interval '30 days'
    ),
    (
      context.picker_clicker_game_id,
      now() + interval '30 days'
    ),
    (
      context.locked_game_id,
      now() + interval '1 minute'
    )
) as games(game_id, kickoff_at);

-- Commissioner session.
set local role authenticated;

select set_config(
  'request.jwt.claim.sub',
  context.commissioner_user_id::text,
  true
)
from cloud_pick_intent_test_context as context;

select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', context.commissioner_user_id::text,
    'role', 'authenticated'
  )::text,
  true
)
from cloud_pick_intent_test_context as context;

insert into public.player_picks (
  league_id,
  player_id,
  game_id,
  week,
  selected_team,
  source
)
select
  context.league_id,
  context.protected_player_id,
  context.locked_game_id,
  context.week,
  context.away_team,
  'commissioner'::public.pick_source
from cloud_pick_intent_test_context as context;

insert into cloud_pick_intent_test_results (
  test_name,
  passed,
  detail
)
values (
  'Commissioner may manage a locked pick',
  true,
  'The commissioner inserted a protected-player pick inside the five-minute lock window.'
);

-- Return to the SQL Editor owner, clear JWT claims, and temporarily repoint
-- the existing commissioner account link to an unlinked ordinary player.
reset role;

select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '{}', true);

update public.account_links as links
set player_id = context.ordinary_player_id
from cloud_pick_intent_test_context as context
where links.id = context.commissioner_link_id;

-- Ordinary-player session using the same real Auth user and temporary link.
set local role authenticated;

select set_config(
  'request.jwt.claim.sub',
  context.commissioner_user_id::text,
  true
)
from cloud_pick_intent_test_context as context;

select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', context.commissioner_user_id::text,
    'role', 'authenticated'
  )::text,
  true
)
from cloud_pick_intent_test_context as context;

insert into public.player_picks (
  league_id,
  player_id,
  game_id,
  week,
  selected_team,
  source
)
select
  context.league_id,
  context.ordinary_player_id,
  context.manual_game_id,
  context.week,
  context.away_team,
  'player'::public.pick_source
from cloud_pick_intent_test_context as context;

insert into cloud_pick_intent_test_results (
  test_name,
  passed,
  detail
)
values (
  'Ordinary player may save own manual pick',
  true,
  'The temporarily linked ordinary player inserted their own open manual pick.'
);

insert into public.player_picks (
  league_id,
  player_id,
  game_id,
  week,
  selected_team,
  source,
  picker_clicker_source_player_id
)
select
  context.league_id,
  context.ordinary_player_id,
  context.picker_clicker_game_id,
  context.week,
  null,
  'picker_clicker'::public.pick_source,
  context.source_player_id
from cloud_pick_intent_test_context as context;

insert into cloud_pick_intent_test_results (
  test_name,
  passed,
  detail
)
select
  'Ordinary player may save own Picker Clicker intent',
  count(*) = 1,
  case
    when count(*) = 1 then
      'The deliberate third choice was stored for the temporarily linked ordinary player.'
    else
      'The expected Picker Clicker intent row was not visible to its owner.'
  end
from public.player_picks as picks
join cloud_pick_intent_test_context as context
  on context.league_id = picks.league_id
where picks.player_id = context.ordinary_player_id
  and picks.game_id = context.picker_clicker_game_id
  and picks.source = 'picker_clicker'
  and picks.selected_team is null
  and picks.picker_clicker_source_player_id = context.source_player_id;

insert into cloud_pick_intent_test_results (
  test_name,
  passed,
  detail
)
select
  'Pending Picker Clicker intent contains no frozen team',
  count(*) = 1,
  case
    when count(*) = 1 then
      'The intent remains pending with selected_team null and its source player preserved.'
    else
      'The pending intent shape did not match the foundation rules.'
  end
from public.player_picks as picks
join cloud_pick_intent_test_context as context
  on context.league_id = picks.league_id
where picks.player_id = context.ordinary_player_id
  and picks.game_id = context.picker_clicker_game_id
  and picks.selected_team is null
  and picks.picker_clicker_source_player_id = context.source_player_id;

do $self_copy_test$
declare
  context_row cloud_pick_intent_test_context%rowtype;
begin
  select *
  into context_row
  from cloud_pick_intent_test_context;

  begin
    update public.player_picks
    set picker_clicker_source_player_id =
      context_row.ordinary_player_id
    where league_id = context_row.league_id
      and player_id = context_row.ordinary_player_id
      and game_id = context_row.picker_clicker_game_id;

    insert into cloud_pick_intent_test_results (
      test_name,
      passed,
      detail
    )
    values (
      'Self-copy Picker Clicker source is rejected',
      false,
      'The invalid self-copy update unexpectedly succeeded.'
    );
  exception
    when others then
      insert into cloud_pick_intent_test_results (
        test_name,
        passed,
        detail
      )
      values (
        'Self-copy Picker Clicker source is rejected',
        true,
        sqlerrm
      );
  end;
end;
$self_copy_test$;

insert into cloud_pick_intent_test_results (
  test_name,
  passed,
  detail
)
select
  'Ordinary player cannot read another player pick',
  count(*) = 0,
  case
    when count(*) = 0 then
      'The protected-player row is hidden by row-level security.'
    else
      'Another player''s pick was visible to the ordinary account.'
  end
from public.player_picks as picks
join cloud_pick_intent_test_context as context
  on context.league_id = picks.league_id
where picks.player_id = context.protected_player_id
  and picks.game_id = context.locked_game_id;

with changed_rows as (
  update public.player_picks as picks
  set selected_team = context.home_team
  from cloud_pick_intent_test_context as context
  where picks.league_id = context.league_id
    and picks.player_id = context.protected_player_id
    and picks.game_id = context.locked_game_id
  returning 1
)
insert into cloud_pick_intent_test_results (
  test_name,
  passed,
  detail
)
select
  'Ordinary player cannot update another player pick',
  count(*) = 0,
  case
    when count(*) = 0 then
      'Row-level security prevented the cross-player update.'
    else
      'A protected-player pick was unexpectedly updated.'
  end
from changed_rows;

with deleted_rows as (
  delete from public.player_picks as picks
  using cloud_pick_intent_test_context as context
  where picks.league_id = context.league_id
    and picks.player_id = context.protected_player_id
    and picks.game_id = context.locked_game_id
  returning 1
)
insert into cloud_pick_intent_test_results (
  test_name,
  passed,
  detail
)
select
  'Ordinary player cannot clear another player pick',
  count(*) = 0,
  case
    when count(*) = 0 then
      'Row-level security prevented the cross-player delete.'
    else
      'A protected-player pick was unexpectedly deleted.'
  end
from deleted_rows;

do $locked_pick_test$
declare
  context_row cloud_pick_intent_test_context%rowtype;
begin
  select *
  into context_row
  from cloud_pick_intent_test_context;

  begin
    insert into public.player_picks (
      league_id,
      player_id,
      game_id,
      week,
      selected_team,
      source
    )
    values (
      context_row.league_id,
      context_row.ordinary_player_id,
      context_row.locked_game_id,
      context_row.week,
      context_row.away_team,
      'player'::public.pick_source
    );

    insert into cloud_pick_intent_test_results (
      test_name,
      passed,
      detail
    )
    values (
      'Ordinary player is blocked inside the pick lock',
      false,
      'The locked ordinary-player insert unexpectedly succeeded.'
    );
  exception
    when others then
      insert into cloud_pick_intent_test_results (
        test_name,
        passed,
        detail
      )
      values (
        'Ordinary player is blocked inside the pick lock',
        true,
        sqlerrm
      );
  end;
end;
$locked_pick_test$;

with deleted_rows as (
  delete from public.player_picks as picks
  using cloud_pick_intent_test_context as context
  where picks.league_id = context.league_id
    and picks.player_id = context.ordinary_player_id
    and picks.game_id = context.manual_game_id
  returning 1
)
insert into cloud_pick_intent_test_results (
  test_name,
  passed,
  detail
)
select
  'Ordinary player may clear own open manual pick',
  count(*) = 1,
  case
    when count(*) = 1 then
      'The owner cleared their open manual pick.'
    else
      'The owner could not clear the expected open manual pick.'
  end
from deleted_rows;

-- Restore the real commissioner link inside the still-open transaction.
reset role;

select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '{}', true);

update public.account_links as links
set player_id = context.commissioner_player_id
from cloud_pick_intent_test_context as context
where links.id = context.commissioner_link_id;

-- Commissioner session again for source-change and visibility checks.
set local role authenticated;

select set_config(
  'request.jwt.claim.sub',
  context.commissioner_user_id::text,
  true
)
from cloud_pick_intent_test_context as context;

select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', context.commissioner_user_id::text,
    'role', 'authenticated'
  )::text,
  true
)
from cloud_pick_intent_test_context as context;

insert into public.player_picks (
  league_id,
  player_id,
  game_id,
  week,
  selected_team,
  source
)
select
  context.league_id,
  context.source_player_id,
  context.picker_clicker_game_id,
  context.week,
  context.away_team,
  'commissioner'::public.pick_source
from cloud_pick_intent_test_context as context;

update public.player_picks as picks
set selected_team = context.home_team
from cloud_pick_intent_test_context as context
where picks.league_id = context.league_id
  and picks.player_id = context.source_player_id
  and picks.game_id = context.picker_clicker_game_id;

insert into cloud_pick_intent_test_results (
  test_name,
  passed,
  detail
)
select
  'Later source-pick changes preserve Picker Clicker intent',
  count(*) = 1,
  case
    when count(*) = 1 then
      'The source pick changed while the follower intent remained null-team and source-linked.'
    else
      'The follower intent was rewritten or lost after the source pick changed.'
  end
from public.player_picks as follower
join cloud_pick_intent_test_context as context
  on context.league_id = follower.league_id
join public.player_picks as source_pick
  on source_pick.league_id = context.league_id
 and source_pick.player_id = context.source_player_id
 and source_pick.game_id = context.picker_clicker_game_id
where follower.player_id = context.ordinary_player_id
  and follower.game_id = context.picker_clicker_game_id
  and follower.source = 'picker_clicker'
  and follower.selected_team is null
  and follower.picker_clicker_source_player_id =
    context.source_player_id
  and source_pick.selected_team = context.home_team;

insert into cloud_pick_intent_test_results (
  test_name,
  passed,
  detail
)
select
  'Commissioner may read an ordinary player Picker Clicker intent',
  count(*) = 1,
  case
    when count(*) = 1 then
      'Commissioner visibility includes the ordinary player intent.'
    else
      'The commissioner could not read the expected ordinary player intent.'
  end
from public.player_picks as picks
join cloud_pick_intent_test_context as context
  on context.league_id = picks.league_id
where picks.player_id = context.ordinary_player_id
  and picks.game_id = context.picker_clicker_game_id;

-- Repoint temporarily one final time so the ordinary owner can clear the
-- Picker Clicker intent. The final rollback restores the real link.
reset role;

select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '{}', true);

update public.account_links as links
set player_id = context.ordinary_player_id
from cloud_pick_intent_test_context as context
where links.id = context.commissioner_link_id;

set local role authenticated;

select set_config(
  'request.jwt.claim.sub',
  context.commissioner_user_id::text,
  true
)
from cloud_pick_intent_test_context as context;

select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', context.commissioner_user_id::text,
    'role', 'authenticated'
  )::text,
  true
)
from cloud_pick_intent_test_context as context;

with deleted_rows as (
  delete from public.player_picks as picks
  using cloud_pick_intent_test_context as context
  where picks.league_id = context.league_id
    and picks.player_id = context.ordinary_player_id
    and picks.game_id = context.picker_clicker_game_id
  returning 1
)
insert into cloud_pick_intent_test_results (
  test_name,
  passed,
  detail
)
select
  'Ordinary player may clear own open Picker Clicker intent',
  count(*) = 1,
  case
    when count(*) = 1 then
      'The owner cleared their deliberate third-choice intent.'
    else
      'The owner could not clear the expected open Picker Clicker intent.'
  end
from deleted_rows;

reset role;

select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '{}', true);

select
  test_name,
  passed,
  detail
from cloud_pick_intent_test_results
order by test_name;

select
  count(*) as test_count,
  count(*) filter (where passed) as passed_count,
  count(*) filter (where not passed) as failed_count,
  coalesce(bool_and(passed), false) as all_rls_tests_passed
from cloud_pick_intent_test_results;

rollback;
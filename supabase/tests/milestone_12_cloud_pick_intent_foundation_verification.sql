-- Head2Head Brawlin' - Cloud Pick Intent Foundation v1 verification
-- Run the entire file in the Supabase SQL Editor after applying the migration.
-- These checks are read-only and do not expose email addresses or user UUIDs.

select
  schema_version,
  service,
  checked_at
from public.cloud_connection_status();

select
  columns.column_name,
  columns.data_type,
  columns.is_nullable,
  columns.column_default
from information_schema.columns as columns
where columns.table_schema = 'public'
  and columns.table_name = 'player_picks'
  and columns.column_name in (
    'selected_team',
    'source',
    'picker_clicker_source_player_id'
  )
order by columns.column_name;

select
  constraints.conname as constraint_name,
  pg_get_constraintdef(constraints.oid) as definition
from pg_catalog.pg_constraint as constraints
join pg_catalog.pg_class as classes
  on classes.oid = constraints.conrelid
join pg_catalog.pg_namespace as namespaces
  on namespaces.oid = classes.relnamespace
where namespaces.nspname = 'public'
  and classes.relname = 'player_picks'
  and constraints.conname in (
    'player_picks_picker_clicker_source_player_fk',
    'player_picks_intent_shape_check'
  )
order by constraints.conname;

select
  routines.routine_name,
  routines.security_type
from information_schema.routines as routines
where routines.routine_schema = 'public'
  and routines.routine_name in (
    'validate_player_pick',
    'can_edit_player_pick',
    'is_pick_open',
    'cloud_connection_status'
  )
order by routines.routine_name;

select
  policies.policyname,
  policies.cmd,
  policies.roles
from pg_catalog.pg_policies as policies
where policies.schemaname = 'public'
  and policies.tablename = 'player_picks'
order by policies.policyname;

select
  count(*) filter (
    where picks.source = 'picker_clicker'
      and (
        picks.selected_team is not null
        or picks.picker_clicker_source_player_id is null
        or picks.picker_clicker_source_player_id = picks.player_id
      )
  ) as invalid_picker_clicker_intent_count,
  count(*) filter (
    where picks.source in ('player', 'commissioner')
      and (
        picks.selected_team is null
        or picks.picker_clicker_source_player_id is not null
      )
  ) as invalid_manual_intent_count
from public.player_picks as picks;

with package_columns as (
  select count(*)::integer as column_count
  from information_schema.columns as columns
  where columns.table_schema = 'public'
    and columns.table_name = 'player_picks'
    and (
      (
        columns.column_name = 'selected_team'
        and columns.is_nullable = 'YES'
      )
      or columns.column_name = 'picker_clicker_source_player_id'
    )
),
package_constraints as (
  select count(*)::integer as constraint_count
  from pg_catalog.pg_constraint as constraints
  join pg_catalog.pg_class as classes
    on classes.oid = constraints.conrelid
  join pg_catalog.pg_namespace as namespaces
    on namespaces.oid = classes.relnamespace
  where namespaces.nspname = 'public'
    and classes.relname = 'player_picks'
    and constraints.conname in (
      'player_picks_picker_clicker_source_player_fk',
      'player_picks_intent_shape_check'
    )
),
package_policies as (
  select count(*)::integer as policy_count
  from pg_catalog.pg_policies as policies
  where policies.schemaname = 'public'
    and policies.tablename = 'player_picks'
    and policies.policyname in (
      'player_picks_select_owner_or_manager',
      'player_picks_insert_owner_or_manager',
      'player_picks_update_owner_or_manager',
      'player_picks_delete_owner_or_manager'
    )
),
invalid_rows as (
  select count(*)::integer as invalid_row_count
  from public.player_picks as picks
  where (
    picks.source = 'picker_clicker'
    and (
      picks.selected_team is not null
      or picks.picker_clicker_source_player_id is null
      or picks.picker_clicker_source_player_id = picks.player_id
    )
  )
  or (
    picks.source in ('player', 'commissioner')
    and (
      picks.selected_team is null
      or picks.picker_clicker_source_player_id is not null
    )
  )
)
select
  5 as expected_schema_version,
  package_columns.column_count,
  package_constraints.constraint_count,
  package_policies.policy_count,
  invalid_rows.invalid_row_count,
  (
    package_columns.column_count = 2
    and package_constraints.constraint_count = 2
    and package_policies.policy_count = 4
    and invalid_rows.invalid_row_count = 0
  ) as cloud_pick_intent_foundation_ready
from package_columns
cross join package_constraints
cross join package_policies
cross join invalid_rows;

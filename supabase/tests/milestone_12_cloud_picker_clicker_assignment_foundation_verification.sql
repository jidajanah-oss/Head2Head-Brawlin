-- Head2Head Brawlin' - Cloud Picker Clicker Assignment Foundation v1 verification
--
-- Run this entire file in the Supabase SQL Editor after both assignment
-- foundation migrations have been applied.

with package_columns as (
  select count(*)::integer as column_count
  from information_schema.columns as columns
  where columns.table_schema = 'public'
    and columns.table_name =
      'picker_clicker_week_assignments'
    and columns.column_name in (
      'league_id',
      'season',
      'week',
      'source_player_id',
      'source_player_name',
      'source_nfl_team',
      'cycle_number',
      'assigned_at',
      'created_by',
      'created_at'
    )
),
package_constraints as (
  select count(*)::integer as constraint_count
  from pg_catalog.pg_constraint as constraints
  join pg_catalog.pg_class as tables
    on tables.oid = constraints.conrelid
  join pg_catalog.pg_namespace as schemas
    on schemas.oid = tables.relnamespace
  where schemas.nspname = 'public'
    and tables.relname =
      'picker_clicker_week_assignments'
    and constraints.conname in (
      'picker_clicker_week_assignments_pkey',
      'picker_clicker_week_assignments_source_player_fk',
      'picker_clicker_week_assignments_season_check',
      'picker_clicker_week_assignments_week_check',
      'picker_clicker_week_assignments_source_player_id_length_check',
      'picker_clicker_week_assignments_source_player_name_length_check',
      'picker_clicker_week_assignments_source_nfl_team_format_check',
      'picker_clicker_week_assignments_cycle_number_check',
      'picker_clicker_week_assignments_cycle_source_key'
    )
),
package_policies as (
  select count(*)::integer as policy_count
  from pg_catalog.pg_policies as policies
  where policies.schemaname = 'public'
    and policies.tablename =
      'picker_clicker_week_assignments'
    and policies.policyname in (
      'picker_clicker_week_assignments_select_members',
      'picker_clicker_week_assignments_insert_managers'
    )
),
strict_insert_policy as (
  select count(*)::integer as strict_insert_policy_count
  from pg_catalog.pg_policies as policies
  where policies.schemaname = 'public'
    and policies.tablename =
      'picker_clicker_week_assignments'
    and policies.policyname =
      'picker_clicker_week_assignments_insert_managers'
    and policies.cmd = 'INSERT'
    and policies.with_check ilike '%can_manage_league%'
    and policies.with_check not ilike '%can_bootstrap_league%'
),
package_triggers as (
  select count(distinct triggers.trigger_name)::integer
    as trigger_count
  from information_schema.triggers as triggers
  where triggers.trigger_schema = 'public'
    and triggers.event_object_table =
      'picker_clicker_week_assignments'
    and triggers.trigger_name =
      'picker_clicker_week_assignments_validate'
),
package_security as (
  select
    tables.relrowsecurity as rls_enabled,
    has_table_privilege(
      'authenticated',
      'public.picker_clicker_week_assignments',
      'select'
    ) as authenticated_can_select,
    has_table_privilege(
      'authenticated',
      'public.picker_clicker_week_assignments',
      'insert'
    ) as authenticated_can_insert,
    has_table_privilege(
      'authenticated',
      'public.picker_clicker_week_assignments',
      'update'
    ) as authenticated_can_update,
    has_table_privilege(
      'authenticated',
      'public.picker_clicker_week_assignments',
      'delete'
    ) as authenticated_can_delete
  from pg_catalog.pg_class as tables
  join pg_catalog.pg_namespace as schemas
    on schemas.oid = tables.relnamespace
  where schemas.nspname = 'public'
    and tables.relname =
      'picker_clicker_week_assignments'
),
schema_health as (
  select status.schema_version
  from public.cloud_connection_status() as status
),
invalid_rows as (
  select count(*)::integer as invalid_row_count
  from public.picker_clicker_week_assignments
    as assignments
  join public.leagues as leagues
    on leagues.id = assignments.league_id
  left join public.league_players as players
    on players.league_id = assignments.league_id
   and players.player_id = assignments.source_player_id
  where assignments.season <> leagues.season
    or players.player_id is null
    or players.status <> 'active'
    or assignments.source_player_name <>
      players.display_name
    or assignments.source_nfl_team <>
      upper(players.nfl_team)
)
select
  6 as expected_schema_version,
  schema_health.schema_version,
  package_columns.column_count,
  package_constraints.constraint_count,
  package_policies.policy_count,
  strict_insert_policy.strict_insert_policy_count,
  package_triggers.trigger_count,
  package_security.rls_enabled,
  package_security.authenticated_can_select,
  package_security.authenticated_can_insert,
  package_security.authenticated_can_update,
  package_security.authenticated_can_delete,
  invalid_rows.invalid_row_count,
  (
    schema_health.schema_version >= 6
    and package_columns.column_count = 10
    and package_constraints.constraint_count = 9
    and package_policies.policy_count = 2
    and strict_insert_policy.strict_insert_policy_count = 1
    and package_triggers.trigger_count = 1
    and package_security.rls_enabled
    and package_security.authenticated_can_select
    and package_security.authenticated_can_insert
    and not package_security.authenticated_can_update
    and not package_security.authenticated_can_delete
    and invalid_rows.invalid_row_count = 0
  ) as cloud_picker_clicker_assignment_foundation_ready
from package_columns
cross join package_constraints
cross join package_policies
cross join strict_insert_policy
cross join package_triggers
cross join package_security
cross join schema_health
cross join invalid_rows;

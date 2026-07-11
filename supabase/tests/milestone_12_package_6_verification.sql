-- Milestone 12 Package 6 verification
-- Run the entire file in the Supabase SQL Editor after the migration.
-- Supabase displays the final SELECT result; the earlier queries remain useful
-- when highlighted and run individually.

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
  and columns.table_name = 'account_link_invitations'
  and columns.column_name in (
    'last_sent_at',
    'send_count'
  )
order by columns.column_name;

select
  routines.routine_name,
  routines.security_type
from information_schema.routines as routines
where routines.routine_schema = 'public'
  and routines.routine_name in (
    'sync_current_league_roster',
    'get_player_account_readiness',
    'prepare_player_account_invitation',
    'revoke_player_account_invitation',
    'claim_my_pending_invitation',
    'cloud_connection_status'
  )
order by routines.routine_name;

select
  has_function_privilege(
    'authenticated',
    'public.sync_current_league_roster(uuid,jsonb)',
    'EXECUTE'
  ) as authenticated_can_sync_roster,
  has_function_privilege(
    'authenticated',
    'public.get_player_account_readiness(uuid)',
    'EXECUTE'
  ) as authenticated_can_read_readiness,
  has_function_privilege(
    'authenticated',
    'public.prepare_player_account_invitation(uuid,text,text)',
    'EXECUTE'
  ) as authenticated_can_prepare_invitation,
  has_function_privilege(
    'authenticated',
    'public.revoke_player_account_invitation(uuid)',
    'EXECUTE'
  ) as authenticated_can_revoke_invitation,
  has_function_privilege(
    'authenticated',
    'public.claim_my_pending_invitation()',
    'EXECUTE'
  ) as authenticated_can_claim_invitation;

with target_league as (
  select leagues.id
  from public.leagues as leagues
  where leagues.slug = 'head2head-brawlin-2026'
  limit 1
),
package_functions as (
  select count(*)::integer as function_count
  from information_schema.routines as routines
  where routines.routine_schema = 'public'
    and routines.routine_name in (
      'sync_current_league_roster',
      'get_player_account_readiness',
      'prepare_player_account_invitation',
      'revoke_player_account_invitation',
      'claim_my_pending_invitation',
      'cloud_connection_status'
    )
    and routines.security_type = 'DEFINER'
),
package_columns as (
  select count(*)::integer as column_count
  from information_schema.columns as columns
  where columns.table_schema = 'public'
    and columns.table_name = 'account_link_invitations'
    and columns.column_name in ('last_sent_at', 'send_count')
),
roster_summary as (
  select
    count(*) filter (
      where players.status = 'active'
    )::integer as active_player_count,
    count(*) filter (
      where players.status = 'active'
        and players.role = 'commissioner'
    )::integer as active_commissioner_count
  from public.league_players as players
  where players.league_id = (
    select target_league.id from target_league
  )
),
link_summary as (
  select
    count(*) filter (
      where links.active
    )::integer as active_account_link_count
  from public.account_links as links
  where links.league_id = (
    select target_league.id from target_league
  )
),
invitation_summary as (
  select
    count(*) filter (
      where invitations.status = 'pending'
    )::integer as pending_invitation_count
  from public.account_link_invitations as invitations
  where invitations.league_id = (
    select target_league.id from target_league
  )
)
select
  4 as expected_schema_version,
  package_functions.function_count,
  package_columns.column_count,
  roster_summary.active_player_count,
  roster_summary.active_commissioner_count,
  link_summary.active_account_link_count,
  invitation_summary.pending_invitation_count,
  (
    package_functions.function_count = 6
    and package_columns.column_count = 2
    and roster_summary.active_commissioner_count = 1
    and link_summary.active_account_link_count >= 1
  ) as package_6_database_ready
from package_functions
cross join package_columns
cross join roster_summary
cross join link_summary
cross join invitation_summary;

-- Milestone 12 Package 2 verification queries
-- Run in the Supabase SQL Editor after the migration succeeds.
-- These checks are read-only.

select
  tables.table_name,
  classes.relrowsecurity as row_security
from information_schema.tables as tables
join pg_catalog.pg_namespace as namespaces
  on namespaces.nspname = tables.table_schema
join pg_catalog.pg_class as classes
  on classes.relnamespace = namespaces.oid
 and classes.relname = tables.table_name
 and classes.relkind = 'r'
where tables.table_schema = 'public'
  and tables.table_name in (
    'leagues',
    'league_players',
    'account_links',
    'account_link_invitations',
    'league_games',
    'league_documents',
    'player_picks',
    'weekly_pick_submissions'
  )
order by tables.table_name;

select
  tablename,
  policyname,
  cmd,
  roles
from pg_catalog.pg_policies
where schemaname = 'public'
  and tablename in (
    'leagues',
    'league_players',
    'account_links',
    'account_link_invitations',
    'league_games',
    'league_documents',
    'player_picks',
    'weekly_pick_submissions'
  )
order by tablename, policyname;

select
  routine_name,
  security_type
from information_schema.routines
where routine_schema = 'public'
  and routine_name in (
    'current_league_role',
    'is_league_member',
    'can_manage_league',
    'can_manage_accounts',
    'is_own_league_player',
    'can_bootstrap_league',
    'is_pick_open',
    'can_edit_player_pick',
    'validate_account_link',
    'protect_league_player_roles',
    'validate_player_pick'
  )
order by routine_name;

select
  table_name
from information_schema.views
where table_schema = 'public'
  and table_name = 'current_account_link';

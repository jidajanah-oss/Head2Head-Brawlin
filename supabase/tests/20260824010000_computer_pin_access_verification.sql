-- Head2Head Brawlin' — Computer Access PIN verification
-- Read-only checks after applying 20260824010000_computer_pin_access.sql.

select
  to_regclass('public.computer_access_accounts') is not null
    as computer_access_table_exists;

select
  relrowsecurity as rls_enabled
from pg_class
where oid = 'public.computer_access_accounts'::regclass;

select
  indexname,
  indexdef
from pg_indexes
where schemaname = 'public'
  and tablename = 'computer_access_accounts'
order by indexname;

select
  schema_version,
  service,
  checked_at
from public.cloud_connection_status();

-- PIN values should never appear in this table. The only authentication
-- identifiers stored here are the server-managed auth user/email plus
-- lockout/status metadata.
select
  column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'computer_access_accounts'
order by ordinal_position;

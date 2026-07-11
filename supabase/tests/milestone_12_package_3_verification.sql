select
  schema_version,
  service,
  checked_at
from public.cloud_connection_status();

select
  has_function_privilege(
    'anon',
    'public.cloud_connection_status()',
    'EXECUTE'
  ) as anon_can_execute,
  has_function_privilege(
    'authenticated',
    'public.cloud_connection_status()',
    'EXECUTE'
  ) as authenticated_can_execute;

select
  table_name
from information_schema.views
where table_schema = 'public'
  and table_name = 'current_account_link';

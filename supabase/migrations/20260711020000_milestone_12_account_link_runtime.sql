begin;

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
    3 as schema_version,
    'head2head-brawlin'::text as service,
    now() as checked_at
$$;

revoke all on function public.cloud_connection_status()
from public;

grant execute on function public.cloud_connection_status()
to anon, authenticated;

comment on function public.cloud_connection_status() is
  'Browser-safe Package 3 health check. Returns no league or user data.';

commit;

begin;

create or replace function
public.record_player_account_invitation_sent(
  p_invitation_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_recorded boolean;
begin
  update public.account_link_invitations
  set
    last_sent_at =
      coalesce(last_sent_at, now()),
    send_count =
      case
        when last_sent_at is null
          then greatest(send_count, 0) + 1
        else greatest(send_count, 1)
      end,
    updated_at = now()
  where id = p_invitation_id
    and status = 'pending'
  returning true into v_recorded;

  return coalesce(v_recorded, false);
end;
$$;

revoke all on function
public.record_player_account_invitation_sent(uuid)
from public;

revoke all on function
public.record_player_account_invitation_sent(uuid)
from anon;

revoke all on function
public.record_player_account_invitation_sent(uuid)
from authenticated;

grant execute on function
public.record_player_account_invitation_sent(uuid)
to service_role;

comment on function
public.record_player_account_invitation_sent(uuid)
is
  'Records a Supabase invitation delivery exactly once. Restricted to the service role used by the invite-player Edge Function.';

notify pgrst, 'reload schema';

commit;

drop policy if exists "League members can read weekly scoring records"
on public.weekly_scoring_records;

create policy "League members can read weekly scoring records"
on public.weekly_scoring_records
for select
to authenticated
using (
  public.current_league_role(league_id)
    in ('commissioner', 'backup_commissioner', 'player')
);

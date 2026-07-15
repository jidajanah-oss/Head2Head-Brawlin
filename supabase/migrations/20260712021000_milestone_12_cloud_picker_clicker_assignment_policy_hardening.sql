begin;

-- The weekly Picker Clicker source is live-season league data. Only an
-- authenticated commissioner or backup commissioner may create it.
-- League bootstrap authority is intentionally excluded.
drop policy if exists
  picker_clicker_week_assignments_insert_managers
on public.picker_clicker_week_assignments;

create policy picker_clicker_week_assignments_insert_managers
on public.picker_clicker_week_assignments
for insert
to authenticated
with check (
  public.can_manage_league(league_id)
);

comment on policy
  picker_clicker_week_assignments_insert_managers
on public.picker_clicker_week_assignments
is
  'Only a linked active commissioner or backup commissioner may create an immutable weekly Picker Clicker assignment.';

notify pgrst, 'reload schema';

commit;

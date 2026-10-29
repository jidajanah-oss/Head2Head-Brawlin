-- Extend only the two submission week guards; preserve all other live logic.
-- Refuse unexpected function versions rather than overwrite production changes.
begin;
do $migration$
declare
  signature text;
  body text;
  definition text;
  expected_md5 text;
  old_guard text;
  new_guard text;
begin
  foreach signature in array array[
    'public.submit_weekly_picks(uuid,text,smallint)',
    'public.submit_weekly_picks_with_intents(uuid,text,smallint,jsonb)'
  ] loop
    select replace(prosrc, E'\r\n', E'\n'), replace(pg_get_functiondef(oid), E'\r\n', E'\n')
      into body, definition from pg_proc where oid = signature::regprocedure;
    if signature like '%with_intents%' then
      expected_md5 := '971ce79837afaafde8e965f5da4c0ca0';
      old_guard := E'and leagues.current_week =\n      target_week';
      new_guard := E'and target_week between leagues.current_week\n      and least(leagues.current_week + 2, 18)';
    else
      expected_md5 := '4243ac903d84354633b59672e725b3ce';
      old_guard := 'if league_current_week <> target_week then';
      new_guard := E'if target_week < league_current_week\n    or target_week > least(league_current_week + 2, 18) then';
    end if;
    if md5(body) <> expected_md5 or position(old_guard in body) = 0 then
      raise exception 'Unexpected submission function version: %. Inspect before applying Advance Picks.', signature;
    end if;
    definition := replace(definition, old_guard, new_guard);
    definition := replace(definition, 'Only the league current week may be submitted.', 'Choose the current week or either of the next two weeks.');
    definition := replace(definition, 'belong to the current league week', 'belong to the selected league week');
    execute definition;
  end loop;
end;
$migration$;
notify pgrst, 'reload schema';
commit;

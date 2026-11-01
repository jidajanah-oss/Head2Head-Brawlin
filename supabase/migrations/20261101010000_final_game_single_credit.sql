begin;
-- Extend the tested Week 7 rules prospectively; preserve earlier scores,
-- membership checks, deliberate Picker Clicker choices and eligibility.
do $patch$
declare
  previous_definition text;
  candidate_definition text;
  old_guard constant text := 'target_season <> 2026 or target_week <> 7';
  new_guard constant text := 'target_season < 2026 or (target_season = 2026 and target_week < 7)';
begin
  previous_definition := pg_get_functiondef('public.load_live_matchup_scores(uuid,integer,smallint)'::regprocedure);
  if position('final_game_single_credit' in previous_definition) > 0 then return; end if;
  if position('week7_single_credit' in previous_definition) = 0
    or position('week7_completed_game_credit' in previous_definition) = 0
    or array_length(string_to_array(previous_definition, old_guard), 1) <> 3 then
    raise exception 'Unexpected live-scoring definition; apply Week 7 corrections and review before applying.';
  end if;
  candidate_definition := replace(previous_definition, old_guard, new_guard);
  candidate_definition := replace(candidate_definition, '-- week7_single_credit:', '-- final_game_single_credit:');
  execute candidate_definition;
end;
$patch$;
notify pgrst, 'reload schema';
commit;

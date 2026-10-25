begin;

-- Week 7 display timing: a missed game's win waits for that game's valid final.
-- Retain the single-credit correction and all prior-week behavior.
do $patch$
declare
  previous_definition text;
  candidate_definition text;
begin
  previous_definition := pg_get_functiondef('public.load_live_matchup_scores(uuid,integer,smallint)'::regprocedure);
  if position('week7_completed_game_credit' in previous_definition) > 0 then return; end if;
  if position('week7_single_credit' in previous_definition) = 0 then
    raise exception 'Apply the Week 7 single-credit correction first.';
  end if;
  if array_length(string_to_array(previous_definition, 'where g.locked and pick.game_id is null'), 1) <> 2 then
    raise exception 'Unexpected missing-pick calculation; review before applying.';
  end if;
  candidate_definition := replace(previous_definition, 'where g.locked and pick.game_id is null', $credit$
    where g.locked and pick.game_id is null
      -- week7_completed_game_credit: no automatic win before a valid final.
      and (target_season <> 2026 or target_week <> 7 or (
        g.status = 'final' and g.away_score is not null and g.home_score is not null
      ))
  $credit$);
  execute candidate_definition;
end;
$patch$;

notify pgrst, 'reload schema';
commit;

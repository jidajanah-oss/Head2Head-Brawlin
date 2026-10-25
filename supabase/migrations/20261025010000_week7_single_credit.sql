begin;

-- Approved scope: 2026 Week 7 only. Preserve membership, response shape,
-- other weeks and prize eligibility. No score rows are written.
do $patch$
declare
  previous_definition text;
  candidate_definition text;
begin
  previous_definition := pg_get_functiondef('public.load_live_matchup_scores(uuid,integer,smallint)'::regprocedure);
  if position('week7_single_credit' in previous_definition) > 0 then return; end if;
  if array_length(string_to_array(previous_definition, 'end = g.winner_team'), 1) <> 2 then
    raise exception 'Unexpected live-scoring definition; review before applying.';
  end if;
  candidate_definition := replace(previous_definition, 'end = g.winner_team', $credit$
      end = g.winner_team
      -- week7_single_credit: the automatic win replaces normal credit for this game.
      and (target_season <> 2026 or target_week <> 7 or not exists (
        select 1 from opponents matchup
        where matchup.player_id = p.player_id and matchup.opponent_id is not null
          and not exists (
            select 1 from public.player_picks opponent_pick
            where opponent_pick.league_id = target_league_id
              and opponent_pick.player_id = matchup.opponent_id
              and opponent_pick.game_id = g.game_id
              and opponent_pick.week = target_week
          )
      ))
  $credit$);
  execute candidate_definition;
end;
$patch$;

notify pgrst, 'reload schema';
commit;

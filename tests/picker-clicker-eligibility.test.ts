// @ts-nocheck -- legacy fixture coverage includes intentionally omitted fields.
import { it } from 'vitest';
import assert from 'node:assert/strict';
import { applyPickerClickerFallbacks, createPickerClickerWeekState } from '../src/engine/pickerClickerEngine';
import { buildLiveHeadToHeadScores, buildFinalizedWeeklyScoringRecord, buildSeasonPlayerScoringSummaries } from '../src/engine/weeklyScoringEngine';
it('preserves partial, untouched and deliberate-choice eligibility with live/final agreement',()=>{
const players = [['mike','PIT'],['travis','NO'],['source','TB'],['bye','MIN']]
  .map(([id,nflTeam]) => ({id,name:id,nflTeam,status:'active',role:'player'}));
const team = abbreviation => ({id:abbreviation,abbreviation,name:abbreviation,displayName:abbreviation});
function fixture({season=2026,week=8,own='PIT',source='PIT',pending=false,selected=false,allMissing=false}={}) {
  const games = [
    {id:'thursday',homeTeam:team('NE'),awayTeam:team('CHI'),score:{home:20,away:10}},
    {id:'london',homeTeam:team('NO'),awayTeam:team('PIT'),score:{home:10,away:20}}
  ].map(g=>({...g,season,week,kickoff:'2000-01-01T00:00:00Z',status:'final'}));
  if (pending) {games[1].status='scheduled'; delete games[1].score;}
  const picks = {mike:{thursday:'NE',london:own},travis:allMissing?{}:{thursday:'CHI'},source:{thursday:'NE'}};
  if (source) picks.source.london=source;
  const initial=createPickerClickerWeekState({season,week,sourcePlayerId:'source',assignedAt:'2000-01-01T00:00:00Z'});
  if (selected) initial.playerSelectedPicks={travis:{london:{gameId:'london'}}};
  const state=applyPickerClickerFallbacks({players,picks,games:games.map(g=>({id:g.id,week,homeTeam:g.homeTeam.abbreviation,
    awayTeam:g.awayTeam.abbreviation,kickoff:g.kickoff,final:g.status==='final'})),weekState:initial});
  return {players,picks,nflGames:games,season,week,pickerClickerWeekState:state};
}
for(const own of ['PIT','NO']) for(const source of ['PIT','NO',null]) {
  const f=fixture({own,source});
  const live=buildLiveHeadToHeadScores(f);
  assert.equal(live.mike,2,'one correct Thursday plus exactly one automatic Sunday win');
  assert.equal(live.travis,0,'automatic copied choices earn no normal points');
  assert.equal(live.bye,0);
  assert.deepEqual(buildLiveHeadToHeadScores(f),live,'refreshes do not accumulate');
  const final=buildFinalizedWeeklyScoringRecord(f);
  const matchup=final.matchups.find(m=>m.playerAId==='mike'||m.playerBId==='mike');
  assert.equal(matchup.playerAId==='mike'?matchup.playerAScore:matchup.playerBScore,2);
  assert.equal(final.playerResults.mike.correctPicks,own==='PIT'?2:1,'raw prize stats remain separate');
  assert.equal(final.playerResults.travis.weeklyPrizeEligible,true,'partial omission remains eligible');
}
assert.equal(buildLiveHeadToHeadScores(fixture({pending:true})).mike,1,'automatic win waits for NFL final');
for (const status of ['scheduled','live','halftime']) {
  const f=fixture(); f.nflGames[1].status=status;
  assert.equal(buildLiveHeadToHeadScores(f).mike,1,'no automatic win while game is unfinished');
}
const invalidFinal=fixture(); delete invalidFinal.nflGames[1].score;
assert.equal(buildLiveHeadToHeadScores(invalidFinal).mike,1,'final needs valid scores');
const tiedFinal=fixture(); tiedFinal.nflGames[1].score={home:10,away:10};
assert.equal(buildLiveHeadToHeadScores(tiedFinal).mike,2,'automatic win applies to a tied NFL final');
const tiedRecord=buildFinalizedWeeklyScoringRecord(tiedFinal);
const tiedMatchup=tiedRecord.matchups.find(m=>m.playerAId==='mike'||m.playerBId==='mike');
assert.equal(tiedMatchup.playerAId==='mike'?tiedMatchup.playerAScore:tiedMatchup.playerBScore,2);
const canceled=fixture(); canceled.nflGames[1].status='canceled';
assert.equal(buildLiveHeadToHeadScores(canceled).mike,1,'canceled game supplies no completed-game win');
const canceledRecord=buildFinalizedWeeklyScoringRecord(canceled);
const canceledMatchup=canceledRecord.matchups.find(m=>m.playerAId==='mike'||m.playerBId==='mike');
assert.equal(canceledMatchup.playerAId==='mike'?canceledMatchup.playerAScore:canceledMatchup.playerBScore,1);
const selected=fixture({selected:true});
assert.equal(buildLiveHeadToHeadScores(selected).mike,2);
assert.equal(buildLiveHeadToHeadScores(selected).travis,1,'deliberate PC earns normal credit');
assert.equal(buildFinalizedWeeklyScoringRecord(fixture({allMissing:true})).playerResults.travis.weeklyPrizeEligible,false);
for(const options of [{week:6}]) {
  assert.equal(buildLiveHeadToHeadScores(fixture(options)).mike,3,'other weeks/seasons retain existing behavior');
}
const both=fixture(); delete both.picks.mike.london;
// Reapply locks to construct a real fallback for both players.
both.pickerClickerWeekState=applyPickerClickerFallbacks({players,picks:both.picks,
  games:both.nflGames.map(g=>({id:g.id,week:g.week,homeTeam:g.homeTeam.abbreviation,awayTeam:g.awayTeam.abbreviation,kickoff:g.kickoff,final:true})),
  weekState:both.pickerClickerWeekState});
assert.equal(buildLiveHeadToHeadScores(both).mike,2);
assert.equal(buildLiveHeadToHeadScores(both).travis,1);

const untouched=fixture({allMissing:true});
const untouchedRecord=buildFinalizedWeeklyScoringRecord(untouched);
assert.equal(untouchedRecord.playerResults.travis.seasonEligibleCorrectPicks,0);
const summaries=buildSeasonPlayerScoringSummaries({players,scoringHistory:{[untouchedRecord.id]:untouchedRecord},season:2026});
assert.equal(summaries.travis.seasonCorrectPicks,0);
assert.equal(summaries.travis.wins,0);

});

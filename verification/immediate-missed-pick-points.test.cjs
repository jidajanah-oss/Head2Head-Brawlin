const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const ts = require(path.join(root, 'node_modules/typescript'));
const cache = new Map();
function load(file) {
  file = path.resolve(root, file);
  if (!path.extname(file)) file += '.ts';
  if (cache.has(file)) return cache.get(file);
  const exports = {}; cache.set(file, exports);
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  new Function('exports', 'require', code)(exports, name => name.startsWith('.')
    ? load(path.resolve(path.dirname(file), name)) : require(name));
  return exports;
}
const { applyPickerClickerFallbacks, createPickerClickerWeekState } = load('src/engine/pickerClickerEngine.ts');
const { buildLiveHeadToHeadScores, buildFinalizedWeeklyScoringRecord } = load('src/engine/weeklyScoringEngine.ts');
const { loadLiveMatchupScores } = load('src/services/cloudLiveMatchupScoreService.ts');
const players = [['bruce','MIN'],['travis','NO'],['source','TB'],['bye','CAR']]
  .map(([id,nflTeam]) => ({id,name:id,nflTeam,status:'active',role:'player'}));
const team = abbreviation => ({id:abbreviation,abbreviation,name:abbreviation,displayName:abbreviation});
const game = (id,home,away,extra={}) => ({id,week:5,season:2026,kickoff:'2000-01-01T00:00:00Z',
  status:'final',homeTeam:team(home),awayTeam:team(away),score:{home:24,away:16},...extra});
const games = [game('thursday','DAL','TB',{score:{home:16,away:24}}),
  game('matchup','MIN','NO'), ...Array.from({length:12},(_,i)=>game(`g${i}`,'ARI','DET')),
  game('monday','LAR','BUF',{kickoff:'2999-01-01T00:00:00Z',status:'scheduled',score:undefined})];
const picks = {bruce:{thursday:'DAL',monday:'BUF'},travis:{monday:'BUF'},source:{}};
for (const [i,g] of games.slice(1,14).entries()) {
  picks.bruce[g.id] = i<8 ? g.homeTeam.abbreviation : g.awayTeam.abbreviation;
  picks.travis[g.id] = i<9 ? g.homeTeam.abbreviation : g.awayTeam.abbreviation;
}
for (const g of games) picks.source[g.id] = g.id==='thursday' ? 'DAL' : g.homeTeam.abbreviation;
const fresh = () => createPickerClickerWeekState({season:2026,week:5,sourcePlayerId:'source',assignedAt:'2000-01-01T00:00:00Z'});
const applyLocks = (testGames,testPicks=picks,testState=fresh()) => applyPickerClickerFallbacks({
  players,picks:testPicks,games:testGames.map(g=>({id:g.id,week:g.week,homeTeam:g.homeTeam.abbreviation,
    awayTeam:g.awayTeam.abbreviation,kickoff:g.kickoff,final:g.status==='final'})),weekState:testState});
const score = (testGames,testPicks,state) => buildLiveHeadToHeadScores({
  players,picks:testPicks,nflGames:testGames,season:2026,week:5,pickerClickerWeekState:state});
const state = applyLocks(games);
assert.equal(Object.keys(state.fallbackPicks.travis).length,1);
assert(!state.ineligiblePlayerIds.includes('travis'));
assert.deepEqual(score(games,picks,state),{bruce:9,travis:9,source:13,bye:0});
// The bonus exists before kickoff or any completed NFL game.
const beforeFinal = games.map(g=>({...g,status:'scheduled',score:undefined}));
assert.equal(score(beforeFinal,picks,applyLocks(beforeFinal)).bruce,1);
assert.equal(score(beforeFinal,picks,applyLocks(beforeFinal)).travis,0);
const beforeLock = beforeFinal.map(g=>({...g,kickoff:'2999-01-01T00:00:00Z'}));
assert.equal(score(beforeLock,picks,applyLocks(beforeLock)).bruce,0);
// The source's missing, winning or losing choice never affects the bonus.
for (const sourcePick of [undefined,'TB','DAL']) {
  const variant=structuredClone(picks);
  if (sourcePick) variant.source.thursday=sourcePick; else delete variant.source.thursday;
  assert.equal(score(games,variant,applyLocks(games,variant)).bruce,9);
  assert.equal(score(games,variant,applyLocks(games,variant)).travis,9);
}
// A deliberate PC selection is a made pick and receives normal correct credit.
const selected=fresh();
selected.playerSelectedPicks={travis:{thursday:{gameId:'thursday'}}};
const sourceWinning=structuredClone(picks); sourceWinning.source.thursday='TB';
const selectedState=applyLocks(games,sourceWinning,selected);
assert.equal(selectedState.fallbackPicks.travis,undefined);
assert.equal(score(games,sourceWinning,selectedState).bruce,8);
assert.equal(score(games,sourceWinning,selectedState).travis,10);
// Repeated refreshes are pure; the point is never accumulated again.
assert.equal(score(games,picks,applyLocks(games,picks,state)).bruce,9);
const allFinal=games.map(g=>g.id==='monday'?{...g,status:'final',score:{home:10,away:20}}:g);
const finalState=applyLocks(allFinal);
const record=buildFinalizedWeeklyScoringRecord({players,picks,nflGames:allFinal,season:2026,week:5,pickerClickerWeekState:finalState});
assert.equal(record.playerResults.travis.weeklyPrizeEligible,true);
assert.equal(record.playerResults.travis.correctPicks,10);
assert.equal(record.playerResults.bruce.correctPicks,9);
const matchup=record.matchups.find(m=>m.playerAId==='travis'||m.playerAId==='bruce');
assert.equal(matchup.playerAScore,10); assert.equal(matchup.playerBScore,10);
// Winning auto copies are not deliberate correct picks in finalized prize counts.
const winningState=applyLocks(allFinal,sourceWinning);
const winningRecord=buildFinalizedWeeklyScoringRecord({players,picks:sourceWinning,nflGames:allFinal,season:2026,week:5,pickerClickerWeekState:winningState});
assert.equal(winningRecord.playerResults.travis.correctPicks,10);
const empty=structuredClone(picks); empty.travis={};
assert(!applyLocks(games,empty).ineligiblePlayerIds.includes('travis'));
const emptyState=applyLocks(allFinal,empty);
assert(emptyState.ineligiblePlayerIds.includes('travis'));
const emptyRecord=buildFinalizedWeeklyScoringRecord({players,picks:empty,nflGames:allFinal,season:2026,week:5,pickerClickerWeekState:emptyState});
assert.equal(emptyRecord.playerResults.travis.weeklyPrizeEligible,false);
assert.equal(emptyRecord.playerResults.bye.outcome,'bye');
assert.equal(emptyRecord.playerResults.bye.weeklyPrizeEligible,true);
const clientFor = data => ({rpc:async()=>({data,error:null})});
(async()=>{
  const base={season:2026,week:5,completed_games:0,locked_games:1,scores:{bruce:1,travis:0}};
  assert.equal((await loadLiveMatchupScores(clientFor(base),'league',2026,5)).scores.bruce,1);
  // Finalized scoring already adds the missed-pick point to normal correct credit.
  assert.equal((await loadLiveMatchupScores(clientFor({...base,completed_games:1,scores:{bruce:2}}),'league',2026,5)).scores.bruce,2);
  assert.equal((await loadLiveMatchupScores(clientFor({season:2026,week:5,completed_games:14,scores:{bruce:8}}),'league',2026,5)).lockedGames,0);
  for(const bad of [ {...base,locked_games:-1}, {...base,locked_games:'1'},
    {...base,locked_games:0,completed_games:1}, {...base,scores:{bruce:2}},
    {...base,scores:{bruce:0.5}}, {...base,scores:{bruce:-1}}, {...base,week:4} ]) {
    await assert.rejects(loadLiveMatchupScores(clientFor(bad),'league',2026,5));
  }
  console.log('PASS: immediate lock credit, Week 5 9–9, source-independent bonus, deliberate PC, repeat reads, live/final agreement, partial/full omission prize eligibility, bye exemption, pre-final RPC validation and legacy compatibility.');
})().catch(error=>{console.error(error);process.exitCode=1;});

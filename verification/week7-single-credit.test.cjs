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
const { applyPickerClickerFallbacks, createPickerClickerWeekState } = load('src/engine/pickerClickerEngine');
const { buildLiveHeadToHeadScores, buildFinalizedWeeklyScoringRecord } = load('src/engine/weeklyScoringEngine');
const players = [['mike','PIT'],['travis','NO'],['source','TB'],['bye','MIN']]
  .map(([id,nflTeam]) => ({id,name:id,nflTeam,status:'active',role:'player'}));
const team = abbreviation => ({id:abbreviation,abbreviation,name:abbreviation,displayName:abbreviation});
function fixture({season=2026,week=7,own='PIT',source='PIT',pending=false,selected=false,allMissing=false}={}) {
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
assert.equal(buildLiveHeadToHeadScores(fixture({pending:true})).mike,2,'automatic win exists before NFL final');
const selected=fixture({selected:true});
assert.equal(buildLiveHeadToHeadScores(selected).mike,2);
assert.equal(buildLiveHeadToHeadScores(selected).travis,1,'deliberate PC earns normal credit');
assert.equal(buildFinalizedWeeklyScoringRecord(fixture({allMissing:true})).playerResults.travis.weeklyPrizeEligible,false);
for(const options of [{week:6},{week:8},{season:2027}]) {
  assert.equal(buildLiveHeadToHeadScores(fixture(options)).mike,3,'other weeks/seasons retain existing behavior');
}
const both=fixture(); delete both.picks.mike.london;
// Reapply locks to construct a real fallback for both players.
both.pickerClickerWeekState=applyPickerClickerFallbacks({players,picks:both.picks,
  games:both.nflGames.map(g=>({id:g.id,week:g.week,homeTeam:g.homeTeam.abbreviation,awayTeam:g.awayTeam.abbreviation,kickoff:g.kickoff,final:true})),
  weekState:both.pickerClickerWeekState});
assert.equal(buildLiveHeadToHeadScores(both).mike,2);
assert.equal(buildLiveHeadToHeadScores(both).travis,1);
console.log('PASS: Week 7 single credit, live/final agreement, copied and deliberate PC, eligibility, repeat reads, byes, both misses, other weeks/seasons unchanged.');

const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const ts = require(path.join(root, 'node_modules/typescript'));
const cache = new Map();
function load(file) {
  file = path.resolve(root, file);
  if (!path.extname(file)) file += '.ts';
  if (cache.has(file)) return cache.get(file);
  const exports = {}; cache.set(file, exports);
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('exports', 'require', code)(exports, name => name.startsWith('.') ? load(path.resolve(path.dirname(file),name)) : require(name));
  return exports;
}
const {isNFLByeWeek} = load('src/engine/isNFLByeWeek.ts');
const {applyPickerClickerFallbacks,createPickerClickerWeekState} = load('src/engine/pickerClickerEngine.ts');
const {buildFinalizedWeeklyScoringRecord,buildSeasonPlayerScoringSummaries} = load('src/engine/weeklyScoringEngine.ts');
const {getPickCompletionStatus} = load('src/services/cloudPlayerPickStatusService.ts');
const players = ['CAR','KC','WAS','NYG'].map(nflTeam => ({id:nflTeam,name:nflTeam,nflTeam,status:'active',role:'player'}));
const games = [{id:'g1',week:5,homeTeam:'WAS',awayTeam:'NYG',kickoff:'2026-01-01T00:00:00Z',final:true}];
assert.equal(isNFLByeWeek('CAR',5,games),true);
assert.equal(isNFLByeWeek('WAS',5,games),false);
assert.equal(isNFLByeWeek('CAR',5,[]),false);
assert.equal(isNFLByeWeek('CAR',6,games),false);
let state=createPickerClickerWeekState({season:2026,week:5,sourcePlayerId:'WAS',assignedAt:'2026-01-01T00:00:00Z'});
state={...state,fallbackPicks:{CAR:{g1:{team:'WAS'}}},ineligiblePlayerIds:['CAR','KC'],playerSelectedPicks:{CAR:{g1:{gameId:'g1'}}}};
const picks={CAR:{g1:'WAS'},KC:{g1:'WAS'},WAS:{g1:'WAS'}};
const untouched=JSON.stringify(picks);
const cleaned=applyPickerClickerFallbacks({players,picks,games,weekState:state});
assert.equal(cleaned.fallbackPicks.CAR,undefined);
assert.equal(cleaned.fallbackPicks.KC,undefined);
assert.equal(cleaned.playerSelectedPicks.CAR,undefined);
assert(!cleaned.ineligiblePlayerIds.includes('CAR'));
assert(!cleaned.ineligiblePlayerIds.includes('KC'));
assert(cleaned.ineligiblePlayerIds.includes('NYG'));
assert(cleaned.fallbackPicks.NYG.g1);
assert.equal(JSON.stringify(picks),untouched);
const team=abbreviation=>({id:abbreviation,abbreviation,name:abbreviation,displayName:abbreviation});
const nflGames=games.map(g=>({...g,season:2026,status:'final',homeTeam:team(g.homeTeam),awayTeam:team(g.awayTeam),score:{home:20,away:10}}));
const record=buildFinalizedWeeklyScoringRecord({players,picks,nflGames,season:2026,week:5,pickerClickerWeekState:state});
for (const id of ['CAR','KC']) {
  const result=record.playerResults[id];
  assert.equal(result.outcome,'bye'); assert.equal(result.weeklyPrizeEligible,true);
  assert.equal(result.correctPicks,0); assert.equal(result.missingPicks,0); assert.equal(result.possiblePicks,0);
  assert.equal(result.usedPickerClicker,false); assert.equal(result.leaguePointsAwarded,0);
}
assert.equal(record.playerResults.WAS.correctPicks,1);
// Legacy bye results with saved picks or stale penalties must not pollute season totals.
record.playerResults.CAR={...record.playerResults.CAR,correctPicks:1,possiblePicks:15,missingPicks:14,weeklyPrizeEligible:false,usedPickerClicker:true};
const summaries=buildSeasonPlayerScoringSummaries({players,scoringHistory:{[record.id]:record},season:2026});
assert.equal(summaries.CAR.byeWeeks,1); assert.equal(summaries.CAR.losses,0);
assert.equal(summaries.CAR.seasonCorrectPicks,0); assert.equal(summaries.CAR.seasonMissingPicks,0);
assert.equal(summaries.CAR.seasonPossiblePicks,0); assert.equal(summaries.CAR.weeklyPrizeIneligibleWeeks,0);
assert.equal(summaries.CAR.automaticPickerClickerWeeks,0);
assert.equal(getPickCompletionStatus({isBye:true,pickedCount:1,lockedMissingCount:2},15),'bye');
assert.equal(getPickCompletionStatus({isBye:false,pickedCount:1,lockedMissingCount:2},15),'missing-locked');
console.log('PASS: bye detection, Thursday picks ignored and retained, no fallback/ineligibility, zero scoring obligations, legacy season protection, normal player scoring, status precedence.');

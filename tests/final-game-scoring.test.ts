import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, it, expect } from 'vitest';
import { buildLiveHeadToHeadScores } from '../src/engine/weeklyScoringEngine';
import type { Player } from '../src/types/player';
import type { NFLGame } from '../src/engine/nfl/NFLTypes';
import type { PickerClickerWeekState } from '../src/engine/pickerClickerTypes';
let db: PGlite;
const league='00000000-0000-0000-0000-000000000001';
const migration=(name:string)=>readFileSync(`supabase/migrations/${name}.sql`,'utf8');
const files=['20261012010000_immediate_missed_pick_points','20261025010000_week7_single_credit','20261025020000_week7_completed_game_credit'];
const fix='20261101010000_final_game_single_credit';
beforeAll(async()=>{
 db=new PGlite();
 await db.exec(`create role authenticated; create schema auth;
 create function auth.uid() returns uuid language sql as $$select '${league}'::uuid$$;
 create table account_links(league_id uuid,player_id text,user_id uuid,active boolean);
 create table league_players(league_id uuid,player_id text,nfl_team text,status text);
 create table leagues(id uuid,season integer,current_week integer);
 create table league_games(league_id uuid,game_id text,season integer,week smallint,away_team text,home_team text,status text,away_score integer,home_score integer,winner_team text);
 create table player_picks(league_id uuid,player_id text,game_id text,week smallint,source text,selected_team text,picker_clicker_source_player_id text);
 create function is_pick_open(uuid,text) returns boolean language sql as $$select false$$;
 insert into leagues values('${league}',2026,18);
 insert into league_players values('${league}','a','BUF','active'),('${league}','b','NYJ','active');
 insert into account_links values('${league}','a','${league}',true);`);
 for(const file of files) await db.exec(migration(file));
});
afterAll(async()=>{await db.close()});
async function fixture(week=8,status='final',away:number|null=20,home:number|null=10){
 await db.exec('delete from league_games; delete from player_picks;');
 await db.query(`insert into league_games values($1,'g',2026,$2,'BUF','NYJ',$3,$4,$5,'BUF'),($1,'pending',2026,$2,'KC','DEN','in_progress',7,0,null)`,[league,week,status,away,home]);
 await db.query(`insert into player_picks values($1,'a','g',$2,'player','BUF',null),($1,'a','pending',$2,'player','KC',null)`,[league,week]);
}
async function score(week=8){return (await db.query<{s:{scores:Record<string,number>}}>(`select load_live_matchup_scores($1,2026,$2::smallint) s`,[league,week])).rows[0].s.scores}
it('reproduces Week 8 double counting and early credit before the migration',async()=>{
 await fixture(); expect((await score()).a).toBe(3);
 await db.exec(migration(fix)); expect((await score()).a).toBe(1);
 await db.exec(migration(fix)); expect((await score()).a).toBe(1);
});
it('waits for valid finals; tied finals award only the missing-pick win',async()=>{
 for(const status of ['scheduled','in_progress','postponed','canceled']){await fixture(8,status);expect((await score()).a).toBe(0)}
 await fixture(8,'final',null,null);expect((await score()).a).toBe(0);
 await fixture(8,'final',10,10);await db.exec('update league_games set winner_team=null');expect((await score()).a).toBe(1);
});
it('preserves older weeks and applies the same rule in Week 7, 8 and later',async()=>{
 for(const week of [6,7,8,9]){await fixture(week);expect((await score(week)).a).toBe(week===6?3:1)}
});
it('distinguishes deliberate Picker Clicker picks from missing automatic fallbacks',async()=>{
 await fixture();
 await db.query(`insert into player_picks values($1,'b','g',8,'picker_clicker',null,'a')`,[league]);
 expect(await score()).toEqual({a:1,b:1});
 await db.exec(`update player_picks set selected_team='NYJ' where player_id='a' and game_id='g'`);
 expect(await score()).toEqual({a:0,b:0});
});
it('keeps membership checks and bye players at zero',async()=>{
 await fixture();await db.query(`insert into league_players values($1,'bye','SEA','active')`,[league]);
 expect((await score()).bye).toBe(0);
 await db.exec('update account_links set active=false');
 await expect(score()).rejects.toThrow(/membership/);
 await db.exec('update account_links set active=true');
});
const players:Player[]=[{id:'a',name:'A',nflTeam:'BUF',status:'active',role:'player'},{id:'b',name:'B',nflTeam:'NYJ',status:'active',role:'player'}];
const team=(abbreviation:string)=>({id:abbreviation,abbreviation,name:abbreviation,displayName:abbreviation});
it('local live scores also award one per final and preserve eligibility state',()=>{
 for(const week of [6,7,8,9]){
 const games:NFLGame[]=[{id:'g',season:2026,week,kickoff:'2026-10-30T00:00:00Z',status:'final',awayTeam:team('BUF'),homeTeam:team('NYJ'),score:{away:20,home:10}}, {id:'pending',season:2026,week,kickoff:'2026-11-01T18:00:00Z',status:'in_progress',awayTeam:team('KC'),homeTeam:team('DEN'),score:{away:7,home:0}}];
 const fallback=(gameId:string)=>({id:gameId,season:2026,week,gameId,playerId:'b',sourcePlayerId:'a',team:'BUF',status:'copied' as const,appliedAt:''});
 const state:PickerClickerWeekState={id:'w',season:2026,week,assignment:{id:'x',season:2026,week,sourcePlayerId:'a',sourcePlayerName:'A',sourceNFLTeam:'BUF',cycleNumber:1,assignedAt:''},fallbackPicks:{b:{g:fallback('g'),pending:fallback('pending')}},ineligiblePlayerIds:['b'],lockedGameIds:['g','pending'],updatedAt:''};
 const before=JSON.stringify(state);
 expect(buildLiveHeadToHeadScores({players,picks:{a:{g:'BUF',pending:'KC'}},nflGames:games,season:2026,week,pickerClickerWeekState:state}).a).toBe(week===6?3:1);
 expect(JSON.stringify(state)).toBe(before);
 }
});

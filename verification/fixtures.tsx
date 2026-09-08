import React, { createContext, useContext, useState } from 'react';
import { createPickerClickerWeekState } from '../src/engine/pickerClickerEngine';
export const Auth = createContext<any>(null), League=createContext<any>(null), NFL=createContext<any>(null);
export const useAuth=()=>useContext(Auth), useLeague=()=>useContext(League), useNFL=()=>useContext(NFL);
export const account={userId:'test-computer-access',leagueId:'test-league',playerId:'test-owner',season:2026,role:'player',active:true};
export const assignment={id:'test-assignment',season:2026,week:1,sourcePlayerId:'test-other',sourcePlayerName:'Other fixture',sourceNFLTeam:'DAL',cycleNumber:1,assignedAt:new Date().toISOString()};
export const games=Array.from({length:16},(_,i)=>({id:'test-game-'+i,awayTeam:'CAR',homeTeam:'DAL',kickoff:new Date(Date.now()+(i===0?-86400000:86400000)).toISOString(),final:i===0,week:1,season:2026}));
const initial=()=>games.map(g=>({leagueId:account.leagueId,playerId:account.playerId,gameId:g.id,week:1,choice:'manual',selectedTeam:'CAR',submittedAt:null,updatedAt:new Date().toISOString()}));
export let cloud=initial();
export const audit={loads:0,writes:0,submits:0,foreignWrites:0,scheduleReads:0};
export let failReads=false;
export function toggleFailure(){failReads=!failReads;}
export const supabaseClient={};
export async function loadCloudLeagueGames(){audit.scheduleReads++; return [];}
export async function synchronizeCloudLeagueGames(){throw Error('Non-commissioner must not publish schedule');}
export async function loadCloudPlayerPickIntents(_c:any,league:string,player:string){
 audit.loads++; await new Promise(r=>setTimeout(r,150));
 if(failReads) throw Error('Fixture network unavailable');
 if(league!==account.leagueId || player!==account.playerId) throw Error('Wrong owner');
 return structuredClone(cloud);
}
function write(input:any,choice:string){
 audit.writes++; if(input.playerId!==account.playerId) {audit.foreignWrites++;throw Error('Foreign write');}
 const game=games.find(g=>g.id===input.gameId)!;
 if(game.final) throw Error('pick window is closed');
 cloud=cloud.filter(p=>p.gameId!==input.gameId);
 if(choice!=='clear') cloud.push({leagueId:input.leagueId,playerId:input.playerId,gameId:input.gameId,week:1,choice,selectedTeam:input.selectedTeam,submittedAt:null,updatedAt:new Date().toISOString()});
}
export async function saveCloudManualPickIntent(_c:any,i:any){write(i,'manual');}
export async function saveCloudPickerClickerIntent(_c:any,i:any){write(i,'picker-clicker');}
export async function clearCloudPlayerPickIntent(_c:any,i:any){write(i,'clear');}
export async function loadLatestCloudSeasonReset(){return null;}
export function applyLocalSeasonResetIfNeeded(){return false;}
const submission={status:'submitted',submittedAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
export async function loadCloudWeeklyPickSubmission(){return submission;}
export async function submitCloudWeeklyPicks(_c:any,target:any,intents:any[]){
 if(target.playerId!==account.playerId) throw Error('Wrong submit owner');
 if(intents.length!==15 || intents.some(i=>i.gameId===games[0].id)) throw Error('Submit must preserve locked choices and send all 15 open choices');
 audit.submits++;return submission;
}
export async function reopenCloudWeeklyPickSubmission(){throw Error('Must not reopen');}
export function Fixture({children}:any){
 const [signed,setSigned]=useState(true), [epoch,setEpoch]=useState(0);
 const [picks,setPicks]=useState<any>({'test-other':{'test-game-1':'DAL'}});
 const [history,setHistory]=useState<any>({'2026-week-1':createPickerClickerWeekState(assignment)});
 const league={league:{currentWeek:1,season:2026,players:[{id:account.playerId,name:'Returning fixture',nflTeam:'CAR',role:'player',status:'active'},{id:'test-other',name:'Other fixture',nflTeam:'DAL',role:'player',status:'active'}]},picks,activePlayerId:account.playerId,pickerClickerHistory:history,
 setPick:(p:string,g:string,t:string)=>setPicks((old:any)=>({...old,[p]:{...old[p],[g]:t}})),upsertPickerClickerWeekState:(s:any)=>setHistory((old:any)=>({...old,[s.id]:s})),setActivePlayerId:()=>{}};
 const snapshot={season:2026,week:1,weekGames:games,nflGames:games.map(g=>({...g,awayTeam:{abbreviation:g.awayTeam},homeTeam:{abbreviation:g.homeTeam}}))};
 return <Auth.Provider value={{status:signed?'signed-in-linked':'signed-out',accountLink:signed?account:null,access:{isLinked:signed,canManageLeague:false}}}><League.Provider value={league}><NFL.Provider value={{season:2026,week:1,snapshot,loading:false,error:null,setWeek:()=>{}}}>
 <button onClick={()=>{setSigned(false);setPicks({'test-other':{'test-game-1':'DAL'}});}}>Fixture Logout</button>
 <button onClick={()=>setSigned(true)}>Fixture Computer Access Login</button>
 <button onClick={()=>{setEpoch(x=>x+1);setPicks({'test-other':{'test-game-1':'DAL'}});}}>Fixture Fresh Card</button>
 <button onClick={()=>{toggleFailure();setEpoch(x=>x+1);}}>Fixture Toggle Network Failure</button>
 <button onClick={()=>{games.forEach(game=>{game.final=true;});setEpoch(x=>x+1);}}>Fixture Lock All Games</button>
 <pre id="audit">{JSON.stringify({...audit,ownerChoices:Object.values(picks[account.playerId]??{}).filter(Boolean).length,otherPick:picks['test-other']['test-game-1']})}</pre>
 <div key={epoch}>{children}</div>
 </NFL.Provider></League.Provider></Auth.Provider>;
}

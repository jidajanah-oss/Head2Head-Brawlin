import {createContext,useContext,useState} from 'react';
const Auth=createContext<any>(null);
export const useAuth=()=>useContext(Auth);
export const useLeague=()=>({league:{currentWeek:3}});
let calls=0,fail=false;
export const supabaseClient={rpc:async (_name:string,args:any)=>{
  calls++;
  await new Promise(resolve=>setTimeout(resolve,args.target_week===1?1000:80));
  if(fail)return {data:null,error:{message:'Test outage'}};
  const empty=args.target_week===2;
  return {error:null,data:{league_id:'fixture',season:2026,week:args.target_week,total_games:empty?0:16,locked_games:empty?0:args.target_week===1?16:1,players:empty?[]:[
    {player_id:'1',display_name:args.target_week===1?'Prior week player':'Jimbo (example)',nfl_team:'WAS',picked_count:16,locked_missing_count:0},
    {player_id:'2',display_name:'Terry (example)',nfl_team:'PIT',picked_count:12,locked_missing_count:args.target_week===1?4:0},
    {player_id:'3',display_name:'Mitch (example)',nfl_team:'NYG',picked_count:0,locked_missing_count:args.target_week===1?16:1},
    {player_id:'4',display_name:'Travis (example)',nfl_team:'NO',picked_count:13,locked_missing_count:args.target_week===1?3:1},
  ]}};
}};
export function Fixture({children}:any){
  const [role,setRole]=useState('commissioner');
  const [audit,setAudit]=useState(0);
  return <Auth.Provider value={{status:role==='signed-out'?'signed-out':'signed-in-linked',accountLink:role==='signed-out'?null:{userId:role,leagueId:'fixture',playerId:'1',season:2026},access:{canManageLeague:role==='commissioner'||role==='backup_commissioner'}}}>
    <div style={{padding:16,display:'flex',gap:8,flexWrap:'wrap'}}>
      <button onClick={()=>setRole('commissioner')}>Primary commissioner</button><button onClick={()=>setRole('backup_commissioner')}>Backup commissioner</button><button onClick={()=>setRole('player')}>Regular player</button><button onClick={()=>setRole('signed-out')}>Sign out</button><button onClick={()=>{fail=!fail;}}>Toggle failed request</button><button onClick={()=>setAudit(calls)}>Check request count</button><output>Requests: {audit}</output>
    </div><div style={{maxWidth:1150,margin:'0 auto',padding:16}}>{children}</div>
  </Auth.Provider>;
}

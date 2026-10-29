import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { beforeAll, afterAll, it, expect } from "vitest";
let db: PGlite;
const league = "00000000-0000-0000-0000-000000000001";
const user = "00000000-0000-0000-0000-000000000002";
const sourceUser = "00000000-0000-0000-0000-000000000003";
const migration = (name: string) => readFileSync(`supabase/migrations/${name}.sql`, "utf8").replaceAll("\uFEFF", "");
const submit = (week: number, intents: unknown[], player = "p") => db.query(
  "select * from public.submit_weekly_picks_with_intents($1::uuid,$2::text,$3::smallint,$4::jsonb)", [league, player, week, JSON.stringify(intents)]);
const manual = (id: string, team = "BUF") => ({ game_id: id, selected_team: team, source: "player" });
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create schema auth; create schema extensions;
    create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    create function extensions.gen_random_uuid() returns uuid language sql as $$select gen_random_uuid()$$;`);
  const files = ["20260711010000_milestone_12_cloud_schema", "20260712010000_milestone_12_cloud_pick_intent_foundation", "20260712020000_milestone_12_cloud_picker_clicker_assignment_foundation", "20260713030000_milestone_12_cloud_weekly_pick_submission_runtime", "20260722010000_picker_clicker_authorization_submission_consistency", "20260727010000_picker_clicker_member_read_recovery", "20260727020000_global_cloud_pick_write_recovery", "20260727030000_atomic_weekly_pick_sync_submit", "20260728010000_opponent_picks_per_game_lock_reveal", "20260907040000_incremental_weekly_pick_submission", "20261029010000_advance_picks"];
  for (const file of files) await db.exec(migration(file).replace("create extension if not exists pgcrypto with schema extensions;", ""));
  await db.exec(`insert into auth.users(id,email) values ('${user}','p@example.test'),('${sourceUser}','s@example.test');
    insert into public.leagues(id,slug,name,season,current_week,created_by) values('${league}','test','Test',2026,8,'${user}');
    insert into public.league_players(league_id,player_id,display_name,nfl_team,role) values
      ('${league}','p','Player','BUF','player'),('${league}','source','Source','NYJ','commissioner');
    insert into public.account_links(league_id,player_id,user_id,login_email) values
      ('${league}','p','${user}','p@example.test'),('${league}','source','${sourceUser}','s@example.test');
    insert into public.league_games(league_id,game_id,season,week,away_team,home_team,kickoff_at,status)
      select '${league}', 'g'||week,2026,week,'BUF','NYJ',now()+interval '20 days','scheduled' from generate_series(7,11) week;
    insert into public.league_games(league_id,game_id,season,week,away_team,home_team,kickoff_at,status)
      values('${league}','locked',2026,9,'BUF','NYJ',now()+interval '4 minutes','scheduled');
    select set_config('request.jwt.claim.sub','${user}',false);
    set role authenticated;`);
});
afterAll(async () => { await db?.close(); });
it("accepts current + two weeks with the actual protected RPC", async () => {
  for (const week of [8,9,10]) {
    const result = await submit(week,[manual(`g${week}`)]);
    expect(result.rows[0]).toMatchObject({ player_id: "p", week });
  }
});
it("rejects past / too-far weeks and other players", async () => {
  await expect(submit(7,[manual("g7")])).rejects.toThrow(/current week/);
  await expect(submit(11,[manual("g11")])).rejects.toThrow(/current week/);
  await expect(submit(9,[manual("g9")],"source")).rejects.toThrow(/own linked/);
});
it("restores advance picks and edits them without touching another week", async () => {
  await submit(9,[manual("g9","NYJ")]);
  const result = await db.query("select * from load_my_player_pick_intents($1::uuid,'p',9::smallint)",[league]);
  expect(result.rows).toEqual(expect.arrayContaining([expect.objectContaining({ game_id: "g9", selected_team: "NYJ" })]));
  const earlier = await db.query("select * from load_my_player_pick_intents($1::uuid,'p',8::smallint)",[league]);
  expect(earlier.rows[0]).toMatchObject({ selected_team: "BUF" });
});
it("rolls back invalid, duplicate, cross-week and locked choices atomically", async () => {
  for (const intents of [[manual("g9","BAD")],[manual("g9"),manual("g9")],[manual("g8")],[manual("locked")]]) {
    await expect(submit(9,intents)).rejects.toThrow();
    const result = await db.query("select * from load_my_player_pick_intents($1::uuid,'p',9::smallint)",[league]);
    expect(result.rows[0]).toMatchObject({ game_id: "g9", selected_team: "NYJ" });
  }
});
it("keeps opponent choices private until each game's five-minute lock", async () => {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub','${sourceUser}',false); set role authenticated;`);
  await submit(9,[manual("g9","BUF")],"source");
  await db.exec(`reset role; select set_config('request.jwt.claim.sub','${user}',false); set role authenticated;`);
  const reveal = () => db.query<{ revealed_picks: Array<{gameId: string; selectedTeam: string}> }>("select * from get_opponent_pick_reveal($1::uuid,'p',9::smallint)",[league]);
  expect((await reveal()).rows[0].revealed_picks.some(pick => pick.gameId === "g9")).toBe(false);
  await expect(db.query("select * from load_my_player_pick_intents($1::uuid,'source',9::smallint)",[league])).rejects.toThrow();
  await db.exec("begin; reset role; update league_games set kickoff_at=now()+interval '5 minutes 1 second' where game_id='g9'; set role authenticated;");
  expect((await reveal()).rows[0].revealed_picks.some(pick => pick.gameId === "g9")).toBe(false);
  await db.exec("reset role; update league_games set kickoff_at=now()+interval '5 minutes' where game_id='g9'; set role authenticated;");
  expect((await reveal()).rows[0].revealed_picks).toEqual(expect.arrayContaining([expect.objectContaining({ gameId: "g9", selectedTeam: "BUF" })]));
  await expect(submit(9,[manual("g9","NYJ")])).rejects.toThrow();
  await db.exec("rollback;");
});
it("allows every linked player in a full 32-player roster", async () => {
  const teams = ["ARI","ATL","BAL","CAR","CHI","CIN","CLE","DAL","DEN","DET","GB","HOU","IND","JAX","KC","LV","LAC","LAR","MIA","MIN","NE","NO","NYG","PHI","PIT","SF","SEA","TB","TEN","WAS"];
  await db.exec("reset role; select set_config('request.jwt.claim.sub','',false);");
  for (let i=0;i<teams.length;i++) {
    const id = `00000000-0000-0000-0001-${String(i).padStart(12,"0")}`;
    await db.query("insert into auth.users(id,email) values ($1,$2)",[id,`p${i}@example.test`]);
    await db.query("insert into league_players(league_id,player_id,display_name,nfl_team) values($1,$2,$2,$3)",[league,`p${i}`,teams[i]]);
    await db.query("insert into account_links(league_id,player_id,user_id,login_email) values($1,$2,$3,$4)",[league,`p${i}`,id,`p${i}@example.test`]);
  }
  for (let i=0;i<teams.length;i++) {
    const id = `00000000-0000-0000-0001-${String(i).padStart(12,"0")}`;
    await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);
    await db.exec("set role authenticated;");
    expect((await submit(10,[manual("g10")],`p${i}`)).rows[0]).toMatchObject({ player_id: `p${i}`, week: 10 });
    await db.exec("reset role;");
  }
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user]);
  await db.exec("set role authenticated;");
});
it("rejects missing future schedule and preserves the authenticated-only RPC grant", async () => {
  await db.exec("reset role; update leagues set current_week=16; set role authenticated;");
  await expect(submit(18,[])).rejects.toThrow(/cloud schedule is not ready/);
  await db.exec(`reset role; insert into league_games(league_id,game_id,season,week,away_team,home_team,kickoff_at,status) values('${league}','g18',2026,18,'BUF','NYJ',now()+interval '40 days','scheduled'); set role authenticated;`);
  expect((await submit(18,[manual("g18")])).rows[0]).toMatchObject({ week: 18 });
  await expect(submit(19,[manual("g18")])).rejects.toThrow();
  const result = await db.query("select has_function_privilege('anon','public.submit_weekly_picks_with_intents(uuid,text,smallint,jsonb)','EXECUTE') as anon, has_function_privilege('authenticated','public.submit_weekly_picks_with_intents(uuid,text,smallint,jsonb)','EXECUTE') as member");
  expect(result.rows[0]).toEqual({ anon: false, member: true });
});

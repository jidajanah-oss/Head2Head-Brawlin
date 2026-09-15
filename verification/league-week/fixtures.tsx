import { createContext, useContext } from 'react';

export const auth = {
  status: 'signed-in-linked',
  access: { canManageLeague: true, accountLink: { userId: 'fixture-user', leagueId: 'fixture-league' } },
};
export const Auth = createContext(auth);
export const useAuth = () => useContext(Auth);
export const audit = { cloudWeek: 2, reads: 0, writes: 0, fail: false, persisted: null as any };
export const supabaseClient = { rpc(name: string, args: any) {
  return { async abortSignal() {
    await new Promise(resolve => setTimeout(resolve, 40));
    if (args.target_league_id !== 'fixture-league' || args.target_season !== 2026) throw Error('Incorrect league/season');
    if (audit.fail) return { data: null, error: { message: 'Fixture offline' } };
    if (name === 'load_member_league_week') audit.reads++;
    else if (name === 'set_commissioner_league_week') {
      audit.writes++;
      if (args.expected_week !== audit.cloudWeek) return { data: null, error: { message: 'conflict' } };
      audit.cloudWeek = args.target_week;
    } else throw Error('Unexpected RPC');
    return { data: audit.cloudWeek, error: null };
  } };
} };
export function loadPersistedLeagueState(initial: any) {
  return {
    league: { ...initial, currentWeek: 1, players: [{ id: 'fixture-owner', name: 'Fixture owner', nflTeam: 'CAR' }] },
    picks: { 'fixture-owner': { week1game: 'CAR' } }, activePlayerId: 'fixture-owner',
    gameResults: { week1game: 'CAR' }, scoringHistory: { week1: { winner: 'fixture-owner' } },
    pickerClickerHistory: { week1: { source: 'fixture-owner' } }, obscureStatCoinFlipHistory: {},
    payoutLedgerHistory: {}, playoffResultsHistory: {},
  };
}
export function savePersistedLeagueState(state: any) { audit.persisted = state; }
export function clearPersistedLeagueState() { throw Error('Week sync must not clear history'); }

import React from 'react';
import { createRoot } from 'react-dom/client';
import { LeagueProvider, useLeague } from '../../src/context/LeagueContext';
import { SeasonCloseoutProvider } from '../../src/context/SeasonCloseoutContext';
import { Auth, auth, audit } from './fixtures';

let current: ReturnType<typeof useLeague> | null = null;
function Probe() {
  current = useLeague();
  return <p>Active week: {current.league.currentWeek}</p>;
}
const root = createRoot(document.getElementById('root')!);
const render = (value = auth) => root.render(<React.StrictMode><Auth.Provider value={value}>
  <SeasonCloseoutProvider><LeagueProvider><Probe /></LeagueProvider></SeasonCloseoutProvider>
</Auth.Provider></React.StrictMode>);
const delay = () => new Promise(resolve => setTimeout(resolve, 20));
async function until(check: () => boolean) {
  for (let attempt = 0; attempt < 150; attempt++) { if (check()) return; await delay(); }
  throw Error('Timed out waiting for integration state');
}
const results: string[] = [];
function check(condition: unknown, label: string) {
  if (!condition) throw Error(label);
  results.push('PASS: ' + label);
}
async function run() {
  render();
  await until(() => current?.league.currentWeek === 2);
  check(audit.writes === 0, 'StrictMode hydration reads cloud Week 2 without writing cached Week 1');
  const history = JSON.stringify({ picks: current!.picks, scoring: current!.scoringHistory,
    picker: current!.pickerClickerHistory, results: current!.gameResults });
  current!.goToNextWeek();
  check(current!.league.currentWeek === 2, 'Next week waits for cloud acknowledgement');
  await until(() => current?.league.currentWeek === 3);
  check(audit.cloudWeek === 3 && audit.writes === 1, 'Next week persists to cloud');
  current!.goToPreviousWeek();
  await until(() => current?.league.currentWeek === 2);
  current!.setCurrentWeek(4);
  await until(() => current?.league.currentWeek === 4);
  check(audit.cloudWeek === 4 && audit.writes === 3, 'Previous and selector use the same confirmed cloud save');
  check(history === JSON.stringify({ picks: current!.picks, scoring: current!.scoringHistory,
    picker: current!.pickerClickerHistory, results: current!.gameResults }), 'Week 1 picks, results, standings source and Picker Clicker history are preserved');
  audit.cloudWeek = 5;
  window.dispatchEvent(new Event('focus'));
  await until(() => current?.league.currentWeek === 5);
  check(audit.writes === 3, 'Returning to device refreshes without a write');
  audit.cloudWeek = 6;
  window.dispatchEvent(new Event('online'));
  await until(() => current?.league.currentWeek === 6);
  check(audit.writes === 3, 'Reconnection refreshes without a write');
  audit.fail = true;
  current!.setCurrentWeek(7);
  await until(() => !!current?.weekSyncError);
  check(current!.league.currentWeek === 6, 'Save failure leaves confirmed week in place and exposes an error');
  audit.fail = false;
  current!.refreshCurrentWeek();
  await until(() => !current?.weekSyncError);
  render({ ...auth, access: { ...auth.access, canManageLeague: false } });
  await until(() => current?.canChangeWeek === false);
  current!.setCurrentWeek(7);
  await new Promise(resolve => setTimeout(resolve, 100));
  check(audit.cloudWeek === 6 && audit.writes === 3, 'Player account cannot change the active week');
  check(audit.persisted.league.currentWeek === 6, 'Confirmed cloud week is cached locally');
  root.unmount();
  document.getElementById('results')!.textContent = results.join('\n') + '\nALL INTEGRATION CHECKS PASSED';
}
run().catch(error => { document.getElementById('results')!.textContent = results.join('\n') + '\nFAIL: ' + error.stack; });

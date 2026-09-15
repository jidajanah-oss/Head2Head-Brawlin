import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createLeagueWeekSync } from '../src/services/leagueWeekSync.ts';
import { loadCloudLeagueWeek, saveCloudLeagueWeek } from '../src/services/cloudLeagueWeekService.ts';

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function fixture(overrides = {}) {
  const result = { applied: [], states: [], writes: [] };
  result.sync = createLeagueWeekSync({
    load: async () => 2,
    save: async (expected, next) => { result.writes.push([expected, next]); return next; },
    apply: week => result.applied.push(week),
    publish: state => result.states.push(state),
    canManage: true,
    ...overrides,
  });
  return result;
}

test('fresh phone hydrates week 2, and repeated reads never publish the cached week', async () => {
  const f = fixture();
  await f.sync.refresh();
  await f.sync.refresh();
  assert.deepEqual(f.applied, [2, 2]);
  assert.deepEqual(f.writes, []);
  assert.equal(f.states.at(-1).hydrated, true);
});

test('cloud moves forward and backward without clearing existing history', async () => {
  let cloud = 2;
  const history = { week1: { final: true, wins: 1 } };
  const picks = { owner: { game1: 'CAR' } };
  const pickerClicker = { week1: { source: 'owner' } };
  let league = { currentWeek: 1, history, picks, pickerClicker };
  const f = fixture({ load: async () => cloud, apply: week => { league = { ...league, currentWeek: week }; } });
  for (const week of [2, 3, 1, 18]) {
    cloud = week;
    await f.sync.refresh();
    assert.equal(league.currentWeek, week);
    assert.equal(league.history, history);
    assert.equal(league.picks, picks);
    assert.equal(league.pickerClicker, pickerClicker);
  }
});

test('ordinary linked members hydrate but cannot persist a week', async () => {
  const f = fixture({ canManage: false });
  await f.sync.refresh();
  await f.sync.change(3);
  assert.deepEqual(f.writes, []);
  assert.deepEqual(f.applied, [2]);
});

test('no write is possible before hydration', async () => {
  const f = fixture();
  await f.sync.change(2);
  assert.deepEqual(f.writes, []);
});

test('failed hydration retains loading state and retry recovers without writes', async () => {
  let fail = true;
  const f = fixture({ load: async () => { if (fail) throw Error('offline'); return 2; } });
  await f.sync.refresh();
  assert.equal(f.states.at(-1).hydrated, false);
  assert.equal(f.states.at(-1).error, 'offline');
  assert.deepEqual(f.applied, []);
  fail = false;
  await f.sync.refresh();
  assert.equal(f.states.at(-1).error, null);
  assert.equal(f.states.at(-1).hydrated, true);
});

test('saving waits for confirmation and blocks double clicks and polls', async () => {
  const saved = deferred();
  const f = fixture({ save: () => saved.promise });
  await f.sync.refresh();
  const saving = f.sync.change(3);
  await f.sync.change(4);
  await f.sync.refresh();
  assert.deepEqual(f.applied, [2]);
  assert.equal(f.states.at(-1).saving, true);
  saved.resolve(3);
  await saving;
  assert.deepEqual(f.applied, [2, 3]);
  assert.equal(f.states.at(-1).saving, false);
});

test('older poll response cannot roll back a completed save', async () => {
  const oldRead = deferred();
  let reads = 0;
  const f = fixture({ load: () => ++reads === 1 ? Promise.resolve(2) : oldRead.promise });
  await f.sync.refresh();
  const polling = f.sync.refresh();
  await f.sync.change(3);
  oldRead.resolve(2);
  await polling;
  assert.deepEqual(f.applied, [2, 3]);
  assert.deepEqual(f.writes, [[2, 3]]);
});

test('two commissioners cannot overwrite each other with a stale expected week', async () => {
  let cloud = 2;
  const options = {
    load: async () => cloud,
    save: async (expected, next) => {
      if (expected !== cloud) throw Error('conflict');
      cloud = next;
      return cloud;
    },
  };
  const pc = fixture(options), phone = fixture(options);
  await pc.sync.refresh(); await phone.sync.refresh();
  await pc.sync.change(3);
  await phone.sync.change(1);
  assert.equal(cloud, 3);
  assert.equal(phone.applied.at(-1), 3);
  assert.equal(phone.states.at(-1).error, 'conflict');
  await phone.sync.change(4);
  assert.equal(cloud, 4);
});

test('network write failure keeps last confirmed week and reports the failure', async () => {
  const f = fixture({ save: async () => { throw Error('offline'); } });
  await f.sync.refresh();
  await f.sync.change(3);
  assert.equal(f.applied.at(-1), 2);
  assert.equal(f.states.at(-1).error, 'offline');
  assert.equal(f.states.at(-1).saving, false);
});

test('ambiguous save response reconciles actual cloud value without retrying write', async () => {
  let cloud = 2, writes = 0;
  const f = fixture({ load: async () => cloud, save: async () => { writes++; cloud = 3; throw Error('response lost'); } });
  await f.sync.refresh(); await f.sync.change(3);
  assert.equal(f.applied.at(-1), 3);
  assert.equal(writes, 1);
});

test('logout/account change ignores late read and write results', async () => {
  const read = deferred(), save = deferred();
  const old = fixture({ load: () => read.promise });
  const reading = old.sync.refresh();
  old.sync.dispose(); read.resolve(2); await reading;
  assert.deepEqual(old.applied, []);
  const f = fixture({ save: () => save.promise });
  await f.sync.refresh(); const saving = f.sync.change(3);
  f.sync.dispose(); save.resolve(3); await saving;
  assert.deepEqual(f.applied, [2]);
});

test('week boundaries and unchanged selections never send invalid writes', async () => {
  const f = fixture(); await f.sync.refresh();
  for (const value of [0, 19, NaN, 2.5, 2]) await f.sync.change(value);
  assert.deepEqual(f.writes, []);
  await f.sync.change(1); await f.sync.change(18);
  assert.deepEqual(f.writes, [[2, 1], [1, 18]]);
});

function clientResponse(response) {
  const calls = [];
  const client = { rpc(name, args) { calls.push({ name, args }); return { abortSignal: async () => response }; } };
  return { client, calls };
}

test('services scope reads and commissioner compare-and-set writes to linked league and season', async () => {
  const { client, calls } = clientResponse({ data: 2, error: null });
  assert.equal(await loadCloudLeagueWeek(client, 'linked-league', 2026), 2);
  assert.equal(await saveCloudLeagueWeek(client, 'linked-league', 2026, 1, 2), 2);
  assert.deepEqual(calls, [
    { name: 'load_member_league_week', args: { target_league_id: 'linked-league', target_season: 2026 } },
    { name: 'set_commissioner_league_week', args: { target_league_id: 'linked-league', target_season: 2026, expected_week: 1, target_week: 2 } },
  ]);
});

test('services reject permission errors, missing rows and malformed responses', async () => {
  for (const data of [null, '2', 0, 19, 1.5, {}, []]) {
    const { client } = clientResponse({ data, error: null });
    await assert.rejects(loadCloudLeagueWeek(client, 'league', 2026));
    await assert.rejects(saveCloudLeagueWeek(client, 'league', 2026, 1, 2));
  }
  const { client } = clientResponse({ data: null, error: { message: 'permission denied' } });
  await assert.rejects(saveCloudLeagueWeek(client, 'league', 2026, 1, 2), /permission denied/);
  await assert.rejects(loadCloudLeagueWeek(client, 'league', 2026), /permission denied/);
});

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { visibleOpponentReveal, revealedOpponentPick } from '../src/features/picks/visibleOpponentReveal.ts';

const target = { allowed: true, leagueId: 'league', playerId: 'me', season: 2026, week: 1 };
const locked = { gameId: 'early', locked: true, effectiveTeam: 'SEA', intentType: 'manual' };
const response = {
  leagueId: 'league', viewerPlayerId: 'me', season: 2026, week: 1,
  matchupType: 'owned-opponent', canReveal: true,
  revealedPicks: [locked, { gameId: 'later', locked: false, effectiveTeam: 'DAL' }],
};

test('matching authorized response exposes only the server-revealed locked game', () => {
  const visible = visibleOpponentReveal(response, target);
  assert.equal(revealedOpponentPick(visible, 'early'), locked);
  assert.equal(revealedOpponentPick(visible, 'later'), undefined);
  assert.equal(revealedOpponentPick(visible, 'not-returned'), undefined);
});

for (const [key, value] of Object.entries({ allowed: false, leagueId: 'other', playerId: 'other', season: 2027, week: 2 })) {
  test(`stale or unauthorized ${key} cannot expose a prior opponent`, () => {
    assert.equal(visibleOpponentReveal(response, { ...target, [key]: value }), null);
  });
}

test('both-entry eligibility remains required even for a locked row', () => {
  assert.equal(revealedOpponentPick({ ...response, canReveal: false }, 'early'), undefined);
});

test('bye, open opponent, absent and failed responses reveal no selections', () => {
  for (const matchupType of ['bye', 'open-opponent']) {
    assert.equal(revealedOpponentPick({ ...response, matchupType }, 'early'), undefined);
  }
  assert.equal(revealedOpponentPick(null, 'early'), undefined);
  assert.equal(visibleOpponentReveal(null, target), null);
});

test('server-frozen Picker Clicker results and missing picks remain intact', () => {
  for (const intentType of ['picker-clicker-selected', 'picker-clicker-auto', 'missing']) {
    const pick = { ...locked, intentType, effectiveTeam: intentType === 'missing' ? null : 'SEA' };
    assert.equal(revealedOpponentPick({ ...response, revealedPicks: [pick] }, 'early'), pick);
  }
});

import { describe, it, expect, vi, afterEach } from "vitest";
import { advancePickWeeks } from "../src/features/picks/advancePickWeeks";
import { LiveGameStatusEngine } from "../src/engine/gameStatus/LiveGameStatusEngine";
import { PickLockEngine } from "../src/engine/pickLock/PickLockEngine";
import { createPickerClickerWeekState, selectPlayerPickerClicker, applyPickerClickerFallbacks } from "../src/engine/pickerClickerEngine";
import { revealedOpponentPick, visibleOpponentReveal } from "../src/features/picks/visibleOpponentReveal";
import type { CloudOpponentPickReveal } from "../src/services/cloudOpponentPickRevealService";

afterEach(() => vi.useRealTimers());
describe("Advance Picks boundaries", () => {
  it.each([[1,[1,2,3]],[8,[8,9,10]],[16,[16,17,18]],[17,[17,18]],[18,[18]],[0,[]],[19,[]]])("limits week %i to the same regular season", (week, expected) => {
    expect(advancePickWeeks(week as number)).toEqual(expected);
  });
  it("keeps the existing five-minute per-game lock", () => {
    const game = { id: "future", kickoff: "2026-11-08T18:00:00Z" };
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-08T17:54:59.999Z"));
    expect(PickLockEngine.isPickLocked(game)).toBe(false);
    vi.setSystemTime(new Date("2026-11-08T17:55:00Z"));
    expect(PickLockEngine.isPickLocked(game)).toBe(true);
    expect(LiveGameStatusEngine.getStatus({ kickoffTime: game.kickoff })).toBe("locked");
  });
  it("keeps deliberate PC eligibility and rejects copying yourself", () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-29T12:00:00Z"));
    const state = createPickerClickerWeekState({ id: "assignment", season: 2026, week: 10, sourcePlayerId: "source", sourcePlayerName: "Source", sourceNFLTeam: "BUF", cycleNumber: 1, assignedAt: new Date().toISOString() });
    const game = { id: "future", week: 10, kickoff: "2026-11-08T18:00:00Z", awayTeam: "BUF", homeTeam: "NYJ", final: false };
    const selected = selectPlayerPickerClicker({ weekState: state, playerId: "player", game });
    expect(selected.playerSelectedPicks?.player?.future).toBeDefined();
    expect(selected.ineligiblePlayerIds).toEqual([]);
    expect(() => selectPlayerPickerClicker({ weekState: state, playerId: "source", game })).toThrow();
    expect(applyPickerClickerFallbacks({ players: [], picks: {}, games: [game], weekState: selected }).ineligiblePlayerIds).toEqual([]);
    vi.setSystemTime(new Date("2026-11-08T17:55:00Z"));
    expect(() => selectPlayerPickerClicker({ weekState: state, playerId: "player", game })).toThrow();
  });
  it("never displays a stale week's opponent picks or an unlocked pick", () => {
    const response = { leagueId: "league", viewerPlayerId: "p", season: 2026, week: 8, canReveal: true, matchupType: "owned-opponent", revealedPicks: [{ gameId: "g", locked: false }] } as CloudOpponentPickReveal;
    expect(visibleOpponentReveal(response, { allowed: true, leagueId: "league", playerId: "p", season: 2026, week: 9 })).toBeNull();
    expect(revealedOpponentPick(response, "g")).toBeUndefined();
    response.revealedPicks[0].locked = true;
    expect(revealedOpponentPick(response, "g")).toBeDefined();
  });
});

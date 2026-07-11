import type { Game } from "../types/game";
import type { LeagueState } from "../types/league";

/**
 * GLOBAL LEAGUE STATE (single source of truth)
 *
 * The starter roster is intentionally empty. Real players are added through
 * league setup or restored from their protected cloud account link.
 */
export const initialLeagueState: LeagueState & {
  currentWeek: number;
  games: Game[];
  seasonStatus: "preseason" | "active" | "complete";
  pickStatus: "open" | "locked";
} = {
  settings: {
    leagueName: "Head2Head Brawlin'",
    season: "2026 Pick'em",
    maxPlayers: 32,
    pickLockMinutesBeforeKickoff: 5,
  },
  players: [],
  currentWeek: 1,
  seasonStatus: "active",
  pickStatus: "open",
  games: [
    {
      id: "1",
      week: 1,
      homeTeam: "BUF",
      awayTeam: "MIA",
      kickoffTime: "2026-09-05T18:00:00Z",
      status: "upcoming",
    },
    {
      id: "2",
      week: 1,
      homeTeam: "KC",
      awayTeam: "BAL",
      kickoffTime: "2026-09-05T21:25:00Z",
      status: "upcoming",
    },
  ],
};

/** Player Count */
export function getPlayerCount(
  league: typeof initialLeagueState,
) {
  return `${league.players.length}/${league.settings.maxPlayers}`;
}

/** Current Week */
export function getCurrentWeekLabel(
  league: typeof initialLeagueState,
) {
  return `Week ${league.currentWeek}`;
}

/** Pick Status (global for now) */
export function getPickStatusLabel(
  league: typeof initialLeagueState,
) {
  return league.pickStatus === "open" ? "OPEN" : "LOCKED";
}

/** CORE RULE: 5-minute lock before kickoff */
export function isPickLocked(
  game: Game,
  now = new Date(),
) {
  const kickoff = new Date(game.kickoffTime);
  const lockTime = new Date(
    kickoff.getTime() - 5 * 60 * 1000,
  );

  return now >= lockTime;
}

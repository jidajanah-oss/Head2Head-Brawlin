import type { Game } from "../types/game";
import { getWeekGames } from "./schedule";

/**
 * 🧠 GAME ENGINE (CORE LOGIC LAYER)
 * This file controls:
 * - game loading
 * - schedule access
 * - lock rules
 * - display helpers
 */

/**
 * 🏈 Get games for a given week (LIVE SOURCE)
 */
export function getGamesForWeek(week: number): Game[] {
  return getWeekGames(week);
}

/**
 * 🔒 CORE RULE: Picks lock 5 minutes before kickoff
 */
export function isPickLocked(game: Game, now: Date = new Date()): boolean {
  const kickoff = new Date(game.kickoffTime);

  const lockTime = new Date(kickoff.getTime() - 5 * 60 * 1000);

  return now >= lockTime;
}

/**
 * 🏈 Format game for UI display
 */
export function getGameLabel(game: Game): string {
  return `${game.awayTeam} @ ${game.homeTeam}`;
}

/**
 * ⏱ Check if game is live
 */
export function isGameLive(game: Game, now: Date = new Date()): boolean {
  const kickoff = new Date(game.kickoffTime);
  return now >= kickoff && game.status !== "final";
}

/**
 * 🏁 Check if game is finished
 */
export function isGameFinal(game: Game): boolean {
  return game.status === "final";
}

/**
 * 📊 Get simplified game status for UI
 */
export function getGameStatus(game: Game): "upcoming" | "live" | "locked" | "final" {
  if (game.status === "final") return "final";

  if (isGameLive(game)) return "live";

  if (isPickLocked(game)) return "locked";

  return "upcoming";
}
export function attachTestScores() {
  return [
    {
      gameId: "1-1",
      winner: "BUF",
    },
    {
      gameId: "1-2",
      winner: "BAL",
    },
    {
      gameId: "1-3",
      winner: "PHI",
    },
  ];
}
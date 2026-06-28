import type { Game } from "../types/game";

/**
 * 🏈 Determine winner from real scores
 */
export function getGameWinner(game: Game): string | null {
  if (game.homeScore == null || game.awayScore == null) return null;

  if (game.homeScore > game.awayScore) return game.homeTeam;
  if (game.awayScore > game.homeScore) return game.awayTeam;

  return "TIE";
}

/**
 * 📊 Build winners map for a full week
 */
export function buildWeeklyWinners(games: Game[]) {
  const results: Record<string, string> = {};

  for (const game of games) {
    const winner = getGameWinner(game);

    if (winner) {
      results[game.id] = winner;
    }
  }

  return results;
}
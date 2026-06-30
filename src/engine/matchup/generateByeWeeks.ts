import type { MatchupContext, PlayerBye } from "../types";

export function generateByeWeeks(
  context: Omit<MatchupContext, "byePlayers">
): PlayerBye[] {
  const activeTeams = new Set<string>();

  for (const game of context.nflGames) {
    activeTeams.add(game.homeTeam);
    activeTeams.add(game.awayTeam);
  }

  return context.players
    .filter((player) => !activeTeams.has(player.nflTeam))
    .map((player) => ({
      week: context.week,
      playerId: player.id,
      franchiseId: player.nflTeam,
    }));
}
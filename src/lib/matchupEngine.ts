type Player = {
  id: string;
  name: string;
  team: string;
};

type Game = {
  id: string;
  homeTeam: string;
  awayTeam: string;
};

/**
 * 🧠 Find player by NFL team
 */
function findPlayerByTeam(players: Player[], team: string) {
  return players.find((p) => p.team === team);
}

/**
 * 🏈 Generate weekly head-to-head matchups from NFL schedule
 */
export function generateMatchups(
  games: Game[],
  players: Player[]
) {
  const matchups: {
    gameId: string;
    playerA: Player;
    playerB: Player;
  }[] = [];

  const byePlayers: Player[] = [];

  // Track which teams are playing this week
  const activeTeams = new Set<string>();

  for (const game of games) {
    activeTeams.add(game.homeTeam);
    activeTeams.add(game.awayTeam);

    const playerA = findPlayerByTeam(players, game.homeTeam);
    const playerB = findPlayerByTeam(players, game.awayTeam);

    // Only create matchup if BOTH teams have assigned players
    if (playerA && playerB) {
      matchups.push({
        gameId: game.id,
        playerA,
        playerB,
      });
    }
  }

  // Determine BYE players (Option C rule)
  for (const player of players) {
    if (!activeTeams.has(player.team)) {
      byePlayers.push(player);
    }
  }

  return {
    matchups,
    byePlayers,
  };
}
type Picks = Record<string, string>;

export type Player = {
  id: string;
  name: string;
};

export type StandingRow = {
  id: string;
  name: string;
  points: number;
  wins: number;
  losses: number;
  ties: number;
};

/**
 * 🧠 Compare two players and determine match result
 */
export function getMatchResult(
  playerA: Picks,
  playerB: Picks,
  gameWinners: Record<string, string>
) {
  let scoreA = 0;
  let scoreB = 0;

  const gameIds = Object.keys(gameWinners);

  for (const gameId of gameIds) {
    const winner = gameWinners[gameId];

    if (playerA[gameId] === winner) scoreA += 1;
    if (playerB[gameId] === winner) scoreB += 1;
  }

  if (scoreA > scoreB) return "A";
  if (scoreB > scoreA) return "B";
  return "TIE";
}

/**
 * 🏆 Convert match result into league points
 */
export function getPoints(result: "A" | "B" | "TIE") {
  if (result === "A" || result === "B") return 3;
  return 1;
}

/**
 * 🏈 Build standings from head-to-head matchups
 */
export function buildHeadToHeadStandings(
  players: Player[],
  allPicks: Record<string, Picks>,
  gameWinners: Record<string, string>
): StandingRow[] {
  const standings: Record<string, StandingRow> = {};

  for (const player of players) {
    standings[player.id] = {
      id: player.id,
      name: player.name,
      points: 0,
      wins: 0,
      losses: 0,
      ties: 0,
    };
  }

  for (let i = 0; i < players.length; i += 1) {
    for (let j = i + 1; j < players.length; j += 1) {
      const playerA = players[i];
      const playerB = players[j];

      const result = getMatchResult(
        allPicks[playerA.id] || {},
        allPicks[playerB.id] || {},
        gameWinners
      );

      if (result === "A") {
        standings[playerA.id].points += 3;
        standings[playerA.id].wins += 1;
        standings[playerB.id].losses += 1;
      } else if (result === "B") {
        standings[playerB.id].points += 3;
        standings[playerB.id].wins += 1;
        standings[playerA.id].losses += 1;
      } else {
        standings[playerA.id].points += 1;
        standings[playerB.id].points += 1;
        standings[playerA.id].ties += 1;
        standings[playerB.id].ties += 1;
      }
    }
  }

  return Object.values(standings).sort((playerA, playerB) => {
    if (playerB.points !== playerA.points) {
      return playerB.points - playerA.points;
    }

    if (playerB.wins !== playerA.wins) {
      return playerB.wins - playerA.wins;
    }

    return playerA.name.localeCompare(playerB.name);
  });
}
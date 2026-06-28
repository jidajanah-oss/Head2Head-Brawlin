type Picks = Record<string, string>;

export type Player = {
  id: string;
  name: string;
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
) {
  const standings: Record<
    string,
    { id: string; name: string; points: number }
  > = {};

  // init
  for (const p of players) {
    standings[p.id] = {
      id: p.id,
      name: p.name,
      points: 0,
    };
  }

  // compare everyone vs everyone (round robin)
  for (let i = 0; i < players.length; i++) {
    for (let j = i + 1; j < players.length; j++) {
      const a = players[i];
      const b = players[j];

      const result = getMatchResult(
        allPicks[a.id] || {},
        allPicks[b.id] || {},
        gameWinners
      );

      if (result === "A") {
        standings[a.id].points += 3;
      } else if (result === "B") {
        standings[b.id].points += 3;
      } else {
        standings[a.id].points += 1;
        standings[b.id].points += 1;
      }
    }
  }

  return Object.values(standings).sort(
    (x, y) => y.points - x.points
  );
}
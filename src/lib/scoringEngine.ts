type PickMap = Record<string, string>;

type GameResult = Record<string, string>; 
// gameId -> winning team

type Matchup = {
  gameId: string;
  playerA: {
    id: string;
    name: string;
  };
  playerB: {
    id: string;
    name: string;
  };
};

/**
 * 🧠 Count correct picks for a player
 */
function getCorrectCount(
  picks: PickMap,
  results: GameResult
) {
  let score = 0;

  for (const gameId in results) {
    if (picks[gameId] === results[gameId]) {
      score += 1;
    }
  }

  return score;
}

/**
 * 🏆 Resolve one head-to-head matchup
 */
export function resolveMatchup(
  matchup: Matchup,
  allPicks: Record<string, PickMap>,
  gameResults: GameResult
) {
  const picksA = allPicks[matchup.playerA.id] || {};
  const picksB = allPicks[matchup.playerB.id] || {};

  const scoreA = getCorrectCount(picksA, gameResults);
  const scoreB = getCorrectCount(picksB, gameResults);

  if (scoreA > scoreB) {
    return {
      winner: matchup.playerA.id,
      loser: matchup.playerB.id,
      result: "A",
      points: { A: 3, B: 0 },
    };
  }

  if (scoreB > scoreA) {
    return {
      winner: matchup.playerB.id,
      loser: matchup.playerA.id,
      result: "B",
      points: { A: 0, B: 3 },
    };
  }

  return {
    winner: null,
    loser: null,
    result: "TIE",
    points: { A: 1, B: 1 },
  };
}

/**
 * 🏈 Resolve full week
 */
export function resolveWeek(
  matchups: Matchup[],
  allPicks: Record<string, PickMap>,
  gameResults: GameResult
) {
  const results: Record<
    string,
    {
      points: number;
    }
  > = {};

  for (const matchup of matchups) {
    const outcome = resolveMatchup(
      matchup,
      allPicks,
      gameResults
    );

    // initialize
    if (!results[matchup.playerA.id]) {
      results[matchup.playerA.id] = { points: 0 };
    }

    if (!results[matchup.playerB.id]) {
      results[matchup.playerB.id] = { points: 0 };
    }

    // apply points
    results[matchup.playerA.id].points += outcome.points.A;
    results[matchup.playerB.id].points += outcome.points.B;
  }

  return results;
}
import type { Player } from "../types/player";

export type HeadToHeadPicks = Record<string, Record<string, string>>;
export type HeadToHeadGameResults = Record<string, string>;

export type HeadToHeadWeeklyResult =
  | "pending"
  | "win"
  | "loss"
  | "tie"
  | "bye";

export type HeadToHeadMatchup = {
  id: string;
  week: number;
  playerA: Player;
  playerB: Player | null;
};

export type HeadToHeadMatchupResult = HeadToHeadMatchup & {
  playerAScore: number;
  playerBScore: number;
  possiblePoints: number;
  winnerId: string | null;
  resultLabel: string;
  status: "pending" | "final" | "bye";
};

export type HeadToHeadStandingRow = {
  id: string;
  name: string;
  nflTeam: string;
  rank: number;
  wins: number;
  losses: number;
  ties: number;
  leaguePoints: number;
  pickPoints: number;
  possiblePoints: number;
  missingScoredPicks: number;
  weeklyOpponentId: string | null;
  weeklyOpponentName: string;
  weeklyResult: HeadToHeadWeeklyResult;
  weeklyScoreLabel: string;
  hasBye: boolean;
};

function rotatePlayers(players: Player[], shift: number) {
  if (players.length <= 1) {
    return players;
  }

  const normalizedShift = shift % players.length;

  return [
    ...players.slice(normalizedShift),
    ...players.slice(0, normalizedShift),
  ];
}

function getActivePlayers(players: Player[]) {
  return players.filter((player) => player.status === "active");
}

function getPlayerPickScore(
  playerId: string,
  picks: HeadToHeadPicks,
  gameResults: HeadToHeadGameResults
) {
  const playerPicks = picks[playerId] ?? {};
  const scoredGameIds = Object.keys(gameResults).filter(
    (gameId) => Boolean(gameResults[gameId])
  );

  let correct = 0;
  let missing = 0;

  for (const gameId of scoredGameIds) {
    const winningTeam = gameResults[gameId];
    const selectedTeam = playerPicks[gameId];

    if (!selectedTeam) {
      missing += 1;
    }

    if (selectedTeam === winningTeam) {
      correct += 1;
    }
  }

  return {
    correct,
    possible: scoredGameIds.length,
    missing,
  };
}

export function buildWeeklyHeadToHeadMatchups(
  players: Player[],
  week: number
): HeadToHeadMatchup[] {
  const activePlayers = getActivePlayers(players);

  if (activePlayers.length === 0) {
    return [];
  }

  if (activePlayers.length === 1) {
    return [
      {
        id: `week-${week}-matchup-1`,
        week,
        playerA: activePlayers[0],
        playerB: null,
      },
    ];
  }

  const [fixedPlayer, ...rotatingPlayers] = activePlayers;
  const rotationShift = Math.max(week - 1, 0);
  const weeklyOrder =
    week <= 1
      ? activePlayers
      : [fixedPlayer, ...rotatePlayers(rotatingPlayers, rotationShift)];

  const matchups: HeadToHeadMatchup[] = [];

  for (let index = 0; index < weeklyOrder.length; index += 2) {
    const playerA = weeklyOrder[index];
    const playerB = weeklyOrder[index + 1] ?? null;

    matchups.push({
      id: `week-${week}-matchup-${matchups.length + 1}`,
      week,
      playerA,
      playerB,
    });
  }

  return matchups;
}

export function evaluateHeadToHeadMatchup(
  matchup: HeadToHeadMatchup,
  picks: HeadToHeadPicks,
  gameResults: HeadToHeadGameResults
): HeadToHeadMatchupResult {
  const playerAScore = getPlayerPickScore(
    matchup.playerA.id,
    picks,
    gameResults
  );

  if (!matchup.playerB) {
    return {
      ...matchup,
      playerAScore: playerAScore.correct,
      playerBScore: 0,
      possiblePoints: playerAScore.possible,
      winnerId: null,
      resultLabel: "Bye Week",
      status: "bye",
    };
  }

  const playerBScore = getPlayerPickScore(
    matchup.playerB.id,
    picks,
    gameResults
  );

  const possiblePoints = Math.max(playerAScore.possible, playerBScore.possible);

  if (possiblePoints === 0) {
    return {
      ...matchup,
      playerAScore: 0,
      playerBScore: 0,
      possiblePoints,
      winnerId: null,
      resultLabel: "Pending",
      status: "pending",
    };
  }

  if (playerAScore.correct > playerBScore.correct) {
    return {
      ...matchup,
      playerAScore: playerAScore.correct,
      playerBScore: playerBScore.correct,
      possiblePoints,
      winnerId: matchup.playerA.id,
      resultLabel: `${matchup.playerA.name} wins`,
      status: "final",
    };
  }

  if (playerBScore.correct > playerAScore.correct) {
    return {
      ...matchup,
      playerAScore: playerAScore.correct,
      playerBScore: playerBScore.correct,
      possiblePoints,
      winnerId: matchup.playerB.id,
      resultLabel: `${matchup.playerB.name} wins`,
      status: "final",
    };
  }

  return {
    ...matchup,
    playerAScore: playerAScore.correct,
    playerBScore: playerBScore.correct,
    possiblePoints,
    winnerId: null,
    resultLabel: "Tie",
    status: "final",
  };
}

export function buildHeadToHeadStandings(
  players: Player[],
  picks: HeadToHeadPicks,
  gameResults: HeadToHeadGameResults,
  week: number
): HeadToHeadStandingRow[] {
  const activePlayers = getActivePlayers(players);
  const matchups = buildWeeklyHeadToHeadMatchups(activePlayers, week);
  const evaluatedMatchups = matchups.map((matchup) =>
    evaluateHeadToHeadMatchup(matchup, picks, gameResults)
  );

  const rows = activePlayers.reduce<Record<string, HeadToHeadStandingRow>>(
    (standings, player) => {
      const pickScore = getPlayerPickScore(player.id, picks, gameResults);

      standings[player.id] = {
        id: player.id,
        name: player.name,
        nflTeam: player.nflTeam,
        rank: 0,
        wins: 0,
        losses: 0,
        ties: 0,
        leaguePoints: 0,
        pickPoints: pickScore.correct,
        possiblePoints: pickScore.possible,
        missingScoredPicks: pickScore.missing,
        weeklyOpponentId: null,
        weeklyOpponentName: "Waiting",
        weeklyResult: "pending",
        weeklyScoreLabel: "0-0",
        hasBye: false,
      };

      return standings;
    },
    {}
  );

  for (const matchup of evaluatedMatchups) {
    const playerA = rows[matchup.playerA.id];

    if (!playerA) {
      continue;
    }

    if (!matchup.playerB) {
      playerA.weeklyOpponentId = null;
      playerA.weeklyOpponentName = "Bye Week";
      playerA.weeklyResult = "bye";
      playerA.weeklyScoreLabel = `${matchup.playerAScore}-0`;
      playerA.hasBye = true;
      continue;
    }

    const playerB = rows[matchup.playerB.id];

    if (!playerB) {
      continue;
    }

    playerA.weeklyOpponentId = playerB.id;
    playerA.weeklyOpponentName = playerB.name;
    playerA.weeklyScoreLabel = `${matchup.playerAScore}-${matchup.playerBScore}`;

    playerB.weeklyOpponentId = playerA.id;
    playerB.weeklyOpponentName = playerA.name;
    playerB.weeklyScoreLabel = `${matchup.playerBScore}-${matchup.playerAScore}`;

    if (matchup.status === "pending") {
      playerA.weeklyResult = "pending";
      playerB.weeklyResult = "pending";
      continue;
    }

    if (!matchup.winnerId) {
      playerA.ties += 1;
      playerB.ties += 1;
      playerA.leaguePoints += 1;
      playerB.leaguePoints += 1;
      playerA.weeklyResult = "tie";
      playerB.weeklyResult = "tie";
      continue;
    }

    if (matchup.winnerId === playerA.id) {
      playerA.wins += 1;
      playerA.leaguePoints += 3;
      playerA.weeklyResult = "win";

      playerB.losses += 1;
      playerB.weeklyResult = "loss";
      continue;
    }

    playerB.wins += 1;
    playerB.leaguePoints += 3;
    playerB.weeklyResult = "win";

    playerA.losses += 1;
    playerA.weeklyResult = "loss";
  }

  return Object.values(rows)
    .sort((playerA, playerB) => {
      if (playerB.leaguePoints !== playerA.leaguePoints) {
        return playerB.leaguePoints - playerA.leaguePoints;
      }

      if (playerB.wins !== playerA.wins) {
        return playerB.wins - playerA.wins;
      }

      if (playerB.pickPoints !== playerA.pickPoints) {
        return playerB.pickPoints - playerA.pickPoints;
      }

      if (playerA.losses !== playerB.losses) {
        return playerA.losses - playerB.losses;
      }

      return playerA.name.localeCompare(playerB.name);
    })
    .map((player, index) => ({
      ...player,
      rank: index + 1,
    }));
}

export function buildHeadToHeadMatchupResults(
  players: Player[],
  picks: HeadToHeadPicks,
  gameResults: HeadToHeadGameResults,
  week: number
): HeadToHeadMatchupResult[] {
  return buildWeeklyHeadToHeadMatchups(players, week).map((matchup) =>
    evaluateHeadToHeadMatchup(matchup, picks, gameResults)
  );
}

export function formatHeadToHeadRecord(row: HeadToHeadStandingRow) {
  return `${row.wins}-${row.losses}-${row.ties}`;
}

export function formatWeeklyResultLabel(result: HeadToHeadWeeklyResult) {
  if (result === "win") return "Win";
  if (result === "loss") return "Loss";
  if (result === "tie") return "Tie";
  if (result === "bye") return "Bye";
  return "Pending";
}
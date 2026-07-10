import type { Player } from "../types/player";
import {
  buildWeeklyHeadToHeadMatchups,
  type HeadToHeadMatchup,
  type HeadToHeadPicks,
} from "./h2hEngine";
import type { NFLGame, NFLScore } from "./nfl/NFLTypes";
import {
  getWeeklyScoringRecordId,
  type FinalizedWeeklyMatchupRecord,
  type FinalizedWeeklyScoringRecord,
  type SeasonPlayerScoringSummary,
  type WeeklyPlayerScoringResult,
  type WeeklyScoringHistory,
  type WeeklyScoringMatchupType,
} from "./weeklyScoringTypes";

export type NFLWeekCompletionSummary = {
  season: number;
  week: number;

  totalScheduledGames: number;
  completedGameCount: number;
  canceledGameCount: number;
  eligibleScoringGameCount: number;

  completedGameIds: string[];
  canceledGameIds: string[];
  eligibleScoringGameIds: string[];
  tiedGameIds: string[];
  pendingGameIds: string[];

  gameResults: Record<string, string>;

  isComplete: boolean;
};

type NFLGameWithScore = NFLGame & {
  score: NFLScore;
};

type PlayerPickScore = {
  correct: number;
  possible: number;
  missing: number;
};

type BuildFinalizedWeeklyScoringRecordParams = {
  players: Player[];
  picks: HeadToHeadPicks;
  nflGames: NFLGame[];
  season: number;
  week: number;
  finalizedAt?: string;
};

type BuildSeasonPlayerScoringSummariesParams = {
  players: Player[];
  scoringHistory: WeeklyScoringHistory;
  season: number;
  throughWeek?: number;
};

function normalizeTeam(team: string) {
  return team.trim().toUpperCase();
}

function hasValidScore(game: NFLGame): game is NFLGameWithScore {
  const score = game.score;

  return (
    score !== undefined &&
    typeof score.home === "number" &&
    Number.isFinite(score.home) &&
    typeof score.away === "number" &&
    Number.isFinite(score.away)
  );
}

function getWeekGames(
  nflGames: NFLGame[],
  season: number,
  week: number
) {
  return nflGames.filter(
    (game) => game.season === season && game.week === week
  );
}

function resolveMatchupType(
  matchup: HeadToHeadMatchup
): WeeklyScoringMatchupType {
  if (matchup.matchupType) {
    return matchup.matchupType;
  }

  return matchup.playerB ? "owned-opponent" : "bye";
}

function getOpenOpponentName(matchup: HeadToHeadMatchup) {
  const abbreviation =
    matchup.openOpponentTeamAbbreviation ?? "OPEN";

  const displayName =
    matchup.openOpponentTeamDisplayName ?? "Open Team";

  return `${abbreviation} • ${displayName}`;
}

function getPlayerPickScore(
  playerId: string,
  picks: HeadToHeadPicks,
  eligibleScoringGameIds: string[],
  gameResults: Record<string, string>
): PlayerPickScore {
  const playerPicks = picks[playerId] ?? {};

  let correct = 0;
  let missing = 0;

  for (const gameId of eligibleScoringGameIds) {
    const winningTeam = normalizeTeam(
      gameResults[gameId] ?? ""
    );

    const selectedTeam = normalizeTeam(
      playerPicks[gameId] ?? ""
    );

    if (!selectedTeam) {
      missing += 1;
      continue;
    }

    if (selectedTeam === winningTeam) {
      correct += 1;
    }
  }

  return {
    correct,
    possible: eligibleScoringGameIds.length,
    missing,
  };
}

function createWeeklyPlayerResult(params: {
  player: Player;
  matchup: HeadToHeadMatchup;
  matchupType: WeeklyScoringMatchupType;
  opponent: Player | null;
  opponentName: string;
  score: PlayerPickScore;
  outcome: WeeklyPlayerScoringResult["outcome"];
  leaguePointsAwarded: number;
}): WeeklyPlayerScoringResult {
  return {
    playerId: params.player.id,
    playerName: params.player.name,
    nflTeam: params.player.nflTeam,

    matchupId: params.matchup.id,
    matchupType: params.matchupType,

    opponentId: params.opponent?.id ?? null,
    opponentName: params.opponentName,

    correctPicks: params.score.correct,
    possiblePicks: params.score.possible,
    missingPicks: params.score.missing,

    outcome: params.outcome,
    leaguePointsAwarded: params.leaguePointsAwarded,
  };
}

function createEmptySeasonSummary(
  player: Player
): SeasonPlayerScoringSummary {
  return {
    playerId: player.id,
    playerName: player.name,
    nflTeam: player.nflTeam,

    wins: 0,
    losses: 0,
    ties: 0,

    leaguePoints: 0,
    seasonCorrectPicks: 0,
    seasonPossiblePicks: 0,
    seasonMissingPicks: 0,

    completedHeadToHeadWeeks: 0,
    byeWeeks: 0,
    openOpponentWeeks: 0,
  };
}

export function getNFLGameWinner(
  game: NFLGame
): string | null {
  if (game.status !== "final" || !hasValidScore(game)) {
    return null;
  }

  const { home, away } = game.score;

  if (home === away) {
    return null;
  }

  return home > away
    ? normalizeTeam(game.homeTeam.abbreviation)
    : normalizeTeam(game.awayTeam.abbreviation);
}

export function inspectNFLWeekCompletion(
  nflGames: NFLGame[],
  season: number,
  week: number
): NFLWeekCompletionSummary {
  const weekGames = getWeekGames(
    nflGames,
    season,
    week
  );

  const completedGameIds: string[] = [];
  const canceledGameIds: string[] = [];
  const eligibleScoringGameIds: string[] = [];
  const tiedGameIds: string[] = [];
  const pendingGameIds: string[] = [];
  const gameResults: Record<string, string> = {};

  for (const game of weekGames) {
    if (game.status === "canceled") {
      canceledGameIds.push(game.id);
      continue;
    }

    if (game.status !== "final" || !hasValidScore(game)) {
      pendingGameIds.push(game.id);
      continue;
    }

    completedGameIds.push(game.id);

    const { home, away } = game.score;

    if (home === away) {
      tiedGameIds.push(game.id);
      continue;
    }

    const winner = getNFLGameWinner(game);

    if (!winner) {
      pendingGameIds.push(game.id);
      continue;
    }

    eligibleScoringGameIds.push(game.id);
    gameResults[game.id] = winner;
  }

  return {
    season,
    week,

    totalScheduledGames: weekGames.length,
    completedGameCount: completedGameIds.length,
    canceledGameCount: canceledGameIds.length,
    eligibleScoringGameCount:
      eligibleScoringGameIds.length,

    completedGameIds,
    canceledGameIds,
    eligibleScoringGameIds,
    tiedGameIds,
    pendingGameIds,

    gameResults,

    isComplete:
      weekGames.length > 0 &&
      pendingGameIds.length === 0 &&
      completedGameIds.length +
        canceledGameIds.length ===
        weekGames.length,
  };
}

export function canFinalizeWeeklyScoring(
  nflGames: NFLGame[],
  season: number,
  week: number
) {
  return inspectNFLWeekCompletion(
    nflGames,
    season,
    week
  ).isComplete;
}

export function buildFinalizedWeeklyScoringRecord({
  players,
  picks,
  nflGames,
  season,
  week,
  finalizedAt,
}: BuildFinalizedWeeklyScoringRecordParams): FinalizedWeeklyScoringRecord | null {
  const completion = inspectNFLWeekCompletion(
    nflGames,
    season,
    week
  );

  if (!completion.isComplete) {
    return null;
  }

  const weekGames = getWeekGames(
    nflGames,
    season,
    week
  );

  const matchups = buildWeeklyHeadToHeadMatchups(
    players,
    week,
    weekGames
  );

  const recordId = getWeeklyScoringRecordId(
    season,
    week
  );

  const finalizedMatchups: FinalizedWeeklyMatchupRecord[] =
    [];

  const playerResults: Record<
    string,
    WeeklyPlayerScoringResult
  > = {};

  for (const matchup of matchups) {
    const matchupType = resolveMatchupType(matchup);

    const playerAScore = getPlayerPickScore(
      matchup.playerA.id,
      picks,
      completion.eligibleScoringGameIds,
      completion.gameResults
    );

    if (!matchup.playerB) {
      const isOpenOpponent =
        matchupType === "open-opponent";

      const opponentName = isOpenOpponent
        ? getOpenOpponentName(matchup)
        : "Bye Week";

      const resultLabel = isOpenOpponent
        ? `Open Opponent: ${opponentName}`
        : "Bye Week";

      finalizedMatchups.push({
        id: `${recordId}-${matchup.id}`,
        season,
        week,

        matchupId: matchup.id,
        matchupType,

        ...(matchup.sourceGameId
          ? {
              sourceGameId: matchup.sourceGameId,
            }
          : {}),

        playerAId: matchup.playerA.id,
        playerAName: matchup.playerA.name,
        playerATeam: matchup.playerA.nflTeam,

        playerBId: null,
        playerBName: null,
        playerBTeam: null,

        playerAScore: playerAScore.correct,
        playerBScore: 0,
        possiblePoints: playerAScore.possible,

        winnerId: null,
        isTie: false,

        status: isOpenOpponent ? "open" : "bye",
        resultLabel,
      });

      playerResults[matchup.playerA.id] =
        createWeeklyPlayerResult({
          player: matchup.playerA,
          matchup,
          matchupType,
          opponent: null,
          opponentName,
          score: playerAScore,
          outcome: isOpenOpponent
            ? "open"
            : "bye",
          leaguePointsAwarded: 0,
        });

      continue;
    }

    const playerBScore = getPlayerPickScore(
      matchup.playerB.id,
      picks,
      completion.eligibleScoringGameIds,
      completion.gameResults
    );

    const isTie =
      playerAScore.correct ===
      playerBScore.correct;

    const playerAWins =
      playerAScore.correct >
      playerBScore.correct;

    const winnerId = isTie
      ? null
      : playerAWins
        ? matchup.playerA.id
        : matchup.playerB.id;

    const resultLabel = isTie
      ? "Tie"
      : playerAWins
        ? `${matchup.playerA.name} wins`
        : `${matchup.playerB.name} wins`;

    finalizedMatchups.push({
      id: `${recordId}-${matchup.id}`,
      season,
      week,

      matchupId: matchup.id,
      matchupType,

      ...(matchup.sourceGameId
        ? {
            sourceGameId: matchup.sourceGameId,
          }
        : {}),

      playerAId: matchup.playerA.id,
      playerAName: matchup.playerA.name,
      playerATeam: matchup.playerA.nflTeam,

      playerBId: matchup.playerB.id,
      playerBName: matchup.playerB.name,
      playerBTeam: matchup.playerB.nflTeam,

      playerAScore: playerAScore.correct,
      playerBScore: playerBScore.correct,
      possiblePoints:
        completion.eligibleScoringGameCount,

      winnerId,
      isTie,

      status: "final",
      resultLabel,
    });

    playerResults[matchup.playerA.id] =
      createWeeklyPlayerResult({
        player: matchup.playerA,
        matchup,
        matchupType,
        opponent: matchup.playerB,
        opponentName: matchup.playerB.name,
        score: playerAScore,

        outcome: isTie
          ? "tie"
          : playerAWins
            ? "win"
            : "loss",

        leaguePointsAwarded: isTie
          ? 1
          : playerAWins
            ? 3
            : 0,
      });

    playerResults[matchup.playerB.id] =
      createWeeklyPlayerResult({
        player: matchup.playerB,
        matchup,
        matchupType,
        opponent: matchup.playerA,
        opponentName: matchup.playerA.name,
        score: playerBScore,

        outcome: isTie
          ? "tie"
          : playerAWins
            ? "loss"
            : "win",

        leaguePointsAwarded: isTie
          ? 1
          : playerAWins
            ? 0
            : 3,
      });
  }

  return {
    id: recordId,
    season,
    week,
    finalizedAt:
      finalizedAt ?? new Date().toISOString(),

    totalScheduledGames:
      completion.totalScheduledGames,

    completedGameCount:
      completion.completedGameCount,

    canceledGameCount:
      completion.canceledGameCount,

    eligibleScoringGameCount:
      completion.eligibleScoringGameCount,

    completedGameIds:
      completion.completedGameIds,

    canceledGameIds:
      completion.canceledGameIds,

    matchups: finalizedMatchups,
    playerResults,
  };
}

export function hasFinalizedWeeklyScoringRecord(
  scoringHistory: WeeklyScoringHistory,
  season: number,
  week: number
) {
  const recordId = getWeeklyScoringRecordId(
    season,
    week
  );

  return Boolean(scoringHistory[recordId]);
}

export function addFinalizedWeeklyScoringRecord(
  scoringHistory: WeeklyScoringHistory,
  record: FinalizedWeeklyScoringRecord
): WeeklyScoringHistory {
  if (scoringHistory[record.id]) {
    return scoringHistory;
  }

  return {
    ...scoringHistory,
    [record.id]: record,
  };
}

export function buildSeasonPlayerScoringSummaries({
  players,
  scoringHistory,
  season,
  throughWeek,
}: BuildSeasonPlayerScoringSummariesParams): Record<
  string,
  SeasonPlayerScoringSummary
> {
  const activePlayers = players.filter(
    (player) => player.status === "active"
  );

  const summaries = activePlayers.reduce<
    Record<string, SeasonPlayerScoringSummary>
  >((playerSummaries, player) => {
    playerSummaries[player.id] =
      createEmptySeasonSummary(player);

    return playerSummaries;
  }, {});

  const weeklyRecords = Object.values(
    scoringHistory
  )
    .filter(
      (record) =>
        record.season === season &&
        (throughWeek === undefined ||
          record.week <= throughWeek)
    )
    .sort(
      (recordA, recordB) =>
        recordA.week - recordB.week
    );

  for (const weeklyRecord of weeklyRecords) {
    for (const playerResult of Object.values(
      weeklyRecord.playerResults
    )) {
      const summary =
        summaries[playerResult.playerId];

      if (!summary) {
        continue;
      }

      summary.seasonCorrectPicks +=
        playerResult.correctPicks;

      summary.seasonPossiblePicks +=
        playerResult.possiblePicks;

      summary.seasonMissingPicks +=
        playerResult.missingPicks;

      summary.leaguePoints +=
        playerResult.leaguePointsAwarded;

      if (playerResult.outcome === "win") {
        summary.wins += 1;
        summary.completedHeadToHeadWeeks += 1;
        continue;
      }

      if (playerResult.outcome === "loss") {
        summary.losses += 1;
        summary.completedHeadToHeadWeeks += 1;
        continue;
      }

      if (playerResult.outcome === "tie") {
        summary.ties += 1;
        summary.completedHeadToHeadWeeks += 1;
        continue;
      }

      if (playerResult.outcome === "bye") {
        summary.byeWeeks += 1;
        continue;
      }

      summary.openOpponentWeeks += 1;
    }
  }

  return summaries;
}
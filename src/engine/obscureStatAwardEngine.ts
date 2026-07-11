import type { Player } from "../types/player";
import type {
  NFLGameStatsSnapshot,
  NFLTeamGameStats,
} from "./nfl/NFLGameStatsTypes";
import type { NFLGame } from "./nfl/NFLTypes";
import type {
  ObscureStatAwardCandidate,
  ObscureStatAwardResolutionMethod,
  ObscureStatAwardResult,
  ObscureStatAwardWinner,
} from "./obscureStatAwardTypes";
import {
  getObscureStatAwardId,
} from "./obscureStatAwardTypes";
import { getObscureStatRule } from "./obscureStatSchedule";
import type {
  ObscureStatDirection,
  ObscureStatMetric,
  ObscureStatRule,
} from "./obscureStatTypes";
import {
  buildSeasonPlayerScoringSummaries,
} from "./weeklyScoringEngine";
import {
  getWeeklyScoringRecordId,
} from "./weeklyScoringTypes";
import type {
  WeeklyScoringHistory,
} from "./weeklyScoringTypes";

export type ObscureStatGameStatsById = Record<
  string,
  NFLGameStatsSnapshot | null | undefined
>;

export type BuildObscureStatAwardResultParams = {
  players: Player[];
  nflGames: NFLGame[];
  gameStatsById: ObscureStatGameStatsById;
  scoringHistory: WeeklyScoringHistory;
  season: number;
  week: number;
};

type TeamStatsPair = {
  team: NFLTeamGameStats;
  opponent: NFLTeamGameStats;
};

type InternalCandidate = {
  candidate: ObscureStatAwardCandidate;
  requiredGameStatsFinal: boolean;
};

type ResolvableCandidate =
  ObscureStatAwardCandidate & {
    gameId: string;
    opponentNFLTeam: string;
    statValue: number;
    weeklyCorrectPicks: number;
  };

const TEAM_ABBREVIATION_ALIASES: Record<
  string,
  string
> = {
  JAC: "JAX",
  WSH: "WAS",
};

function normalizeTeam(
  team: string | undefined,
): string {
  const abbreviation =
    team?.trim().toUpperCase() ?? "";

  return (
    TEAM_ABBREVIATION_ALIASES[
      abbreviation
    ] ?? abbreviation
  );
}

function safeDivide(
  numerator: number | null,
  denominator: number | null,
): number | null {
  if (
    numerator === null ||
    denominator === null ||
    !Number.isFinite(numerator) ||
    !Number.isFinite(denominator) ||
    denominator <= 0
  ) {
    return null;
  }

  return numerator / denominator;
}

function roundStatValue(
  value: number,
  decimalPlaces: number,
): number {
  const normalizedDecimalPlaces =
    Number.isInteger(decimalPlaces)
      ? Math.max(0, decimalPlaces)
      : 0;

  const multiplier = 10 **
    normalizedDecimalPlaces;

  return (
    Math.round(
      (value + Number.EPSILON) *
        multiplier,
    ) / multiplier
  );
}

function findPlayerWeekGame(
  player: Player,
  nflGames: NFLGame[],
  season: number,
  week: number,
): NFLGame | null {
  const playerTeam = normalizeTeam(
    player.nflTeam,
  );

  if (!playerTeam) {
    return null;
  }

  return (
    nflGames.find((game) => {
      if (
        game.season !== season ||
        game.week !== week
      ) {
        return false;
      }

      const homeTeam = normalizeTeam(
        game.homeTeam.abbreviation,
      );

      const awayTeam = normalizeTeam(
        game.awayTeam.abbreviation,
      );

      return (
        homeTeam === playerTeam ||
        awayTeam === playerTeam
      );
    }) ?? null
  );
}

function findTeamStatsPair(
  snapshot: NFLGameStatsSnapshot,
  nflTeam: string,
): TeamStatsPair | null {
  const normalizedTeam =
    normalizeTeam(nflTeam);

  const awayTeam = normalizeTeam(
    snapshot.awayTeam.abbreviation,
  );

  const homeTeam = normalizeTeam(
    snapshot.homeTeam.abbreviation,
  );

  if (awayTeam === normalizedTeam) {
    return {
      team: snapshot.awayTeam,
      opponent: snapshot.homeTeam,
    };
  }

  if (homeTeam === normalizedTeam) {
    return {
      team: snapshot.homeTeam,
      opponent: snapshot.awayTeam,
    };
  }

  return null;
}

function calculateObscureStatValue(
  metric: ObscureStatMetric,
  team: NFLTeamGameStats,
  opponent: NFLTeamGameStats,
): number | null {
  switch (metric) {
    case "yards-per-play":
      return (
        team.yardsPerPlay ??
        safeDivide(
          team.totalYards,
          team.totalOffensivePlays,
        )
      );

    case "opponent-yards-per-play":
      return (
        opponent.yardsPerPlay ??
        safeDivide(
          opponent.totalYards,
          opponent.totalOffensivePlays,
        )
      );

    case "first-downs-per-play":
      return safeDivide(
        team.firstDowns,
        team.totalOffensivePlays,
      );

    case "opponent-third-down-plays":
      return opponent.thirdDownAttempts;

    case "punts-per-play":
      return safeDivide(
        team.punts,
        team.totalOffensivePlays,
      );

    case "opponent-yards-per-pass-attempt":
      return opponent.yardsPerPassAttempt;

    case "rushing-yards-per-play":
      return (
        team.yardsPerRushAttempt ??
        safeDivide(
          team.rushingYards,
          team.rushingAttempts,
        )
      );

    case "opponent-yards-per-rushing-attempt":
      return (
        opponent.yardsPerRushAttempt ??
        safeDivide(
          opponent.rushingYards,
          opponent.rushingAttempts,
        )
      );

    case "average-time-of-possession":
      return team.possessionSeconds;

    default:
      return null;
  }
}

function createBaseCandidate(
  player: Player,
  weeklyCorrectPicks: number | null,
  leaguePoints: number,
): ObscureStatAwardCandidate {
  return {
    playerId: player.id,
    playerName: player.name,
    nflTeam: normalizeTeam(
      player.nflTeam,
    ),

    gameId: null,
    opponentNFLTeam: null,

    eligibility: "no-weekly-game",

    statValue: null,

    weeklyCorrectPicks,
    leaguePoints,
    assignedNFLTeamWon: null,

    primaryRank: null,
  };
}

function buildCandidate(
  player: Player,
  nflGames: NFLGame[],
  gameStatsById: ObscureStatGameStatsById,
  rule: ObscureStatRule,
  season: number,
  week: number,
  weeklyCorrectPicks: number | null,
  leaguePoints: number,
): InternalCandidate {
  const baseCandidate =
    createBaseCandidate(
      player,
      weeklyCorrectPicks,
      leaguePoints,
    );

  const game = findPlayerWeekGame(
    player,
    nflGames,
    season,
    week,
  );

  if (!game || game.status === "canceled") {
    return {
      candidate: baseCandidate,
      requiredGameStatsFinal: true,
    };
  }

  const snapshot =
    gameStatsById[game.id];

  if (!snapshot) {
    return {
      candidate: {
        ...baseCandidate,
        gameId: game.id,
        eligibility:
          game.status === "final"
            ? "stat-unavailable"
            : "game-not-final",
      },
      requiredGameStatsFinal: false,
    };
  }

  if (!snapshot.isFinal) {
    return {
      candidate: {
        ...baseCandidate,
        gameId: game.id,
        eligibility: "game-not-final",
      },
      requiredGameStatsFinal: false,
    };
  }

  const teamStatsPair =
    findTeamStatsPair(
      snapshot,
      player.nflTeam,
    );

  if (!teamStatsPair || !rule.metric) {
    return {
      candidate: {
        ...baseCandidate,
        gameId: game.id,
        eligibility: "stat-unavailable",
      },
      requiredGameStatsFinal: true,
    };
  }

  const rawStatValue =
    calculateObscureStatValue(
      rule.metric,
      teamStatsPair.team,
      teamStatsPair.opponent,
    );

  if (
    rawStatValue === null ||
    !Number.isFinite(rawStatValue)
  ) {
    return {
      candidate: {
        ...baseCandidate,
        gameId: game.id,
        opponentNFLTeam:
          normalizeTeam(
            teamStatsPair.opponent
              .abbreviation,
          ),
        eligibility: "stat-unavailable",
        assignedNFLTeamWon:
          teamStatsPair.team.wonGame,
      },
      requiredGameStatsFinal: true,
    };
  }

  return {
    candidate: {
      ...baseCandidate,

      gameId: game.id,

      opponentNFLTeam:
        normalizeTeam(
          teamStatsPair.opponent
            .abbreviation,
        ),

      eligibility: "eligible",

      statValue: roundStatValue(
        rawStatValue,
        rule.displayDecimals,
      ),

      assignedNFLTeamWon:
        teamStatsPair.team.wonGame,
    },

    requiredGameStatsFinal: true,
  };
}

function compareStatValues(
  candidateA: ObscureStatAwardCandidate,
  candidateB: ObscureStatAwardCandidate,
  direction: ObscureStatDirection,
): number {
  const valueA =
    candidateA.statValue;

  const valueB =
    candidateB.statValue;

  if (valueA === null && valueB === null) {
    return candidateA.playerName.localeCompare(
      candidateB.playerName,
    );
  }

  if (valueA === null) {
    return 1;
  }

  if (valueB === null) {
    return -1;
  }

  if (valueA !== valueB) {
    return direction === "highest"
      ? valueB - valueA
      : valueA - valueB;
  }

  return candidateA.playerName.localeCompare(
    candidateB.playerName,
  );
}

function assignPrimaryRanks(
  candidates: ObscureStatAwardCandidate[],
  direction: ObscureStatDirection,
): ObscureStatAwardCandidate[] {
  const eligibleCandidates = candidates
    .filter(
      (candidate) =>
        candidate.eligibility ===
          "eligible" &&
        candidate.statValue !== null,
    )
    .sort((candidateA, candidateB) =>
      compareStatValues(
        candidateA,
        candidateB,
        direction,
      ),
    );

  let previousValue: number | null = null;
  let previousRank = 0;

  const rankedEligibleCandidates =
    eligibleCandidates.map(
      (candidate, index) => {
        const currentValue =
          candidate.statValue;

        const hasSameValue =
          index > 0 &&
          currentValue === previousValue;

        const rank = hasSameValue
          ? previousRank
          : index + 1;

        previousValue = currentValue;
        previousRank = rank;

        return {
          ...candidate,
          primaryRank: rank,
        };
      },
    );

  const rankedCandidatesById =
    new Map(
      rankedEligibleCandidates.map(
        (candidate) => [
          candidate.playerId,
          candidate,
        ],
      ),
    );

  return [...candidates]
    .map(
      (candidate) =>
        rankedCandidatesById.get(
          candidate.playerId,
        ) ?? candidate,
    )
    .sort((candidateA, candidateB) => {
      if (
        candidateA.primaryRank !== null &&
        candidateB.primaryRank !== null
      ) {
        if (
          candidateA.primaryRank !==
          candidateB.primaryRank
        ) {
          return (
            candidateA.primaryRank -
            candidateB.primaryRank
          );
        }
      } else if (
        candidateA.primaryRank !== null
      ) {
        return -1;
      } else if (
        candidateB.primaryRank !== null
      ) {
        return 1;
      }

      return candidateA.playerName.localeCompare(
        candidateB.playerName,
      );
    });
}

function isResolvableCandidate(
  candidate: ObscureStatAwardCandidate,
): candidate is ResolvableCandidate {
  return (
    candidate.eligibility === "eligible" &&
    typeof candidate.gameId === "string" &&
    candidate.gameId.length > 0 &&
    typeof candidate.opponentNFLTeam ===
      "string" &&
    candidate.opponentNFLTeam.length > 0 &&
    typeof candidate.statValue ===
      "number" &&
    Number.isFinite(candidate.statValue) &&
    typeof candidate.weeklyCorrectPicks ===
      "number" &&
    Number.isFinite(
      candidate.weeklyCorrectPicks,
    )
  );
}

function keepMaximumCandidates(
  candidates: ResolvableCandidate[],
  getValue: (
    candidate: ResolvableCandidate,
  ) => number,
): ResolvableCandidate[] {
  if (candidates.length === 0) {
    return [];
  }

  const maximumValue = Math.max(
    ...candidates.map(getValue),
  );

  return candidates.filter(
    (candidate) =>
      getValue(candidate) ===
      maximumValue,
  );
}

function createWinner(
  candidate: ResolvableCandidate,
  resolutionMethod:
    ObscureStatAwardResolutionMethod,
): ObscureStatAwardWinner {
  return {
    playerId: candidate.playerId,
    playerName: candidate.playerName,
    nflTeam: candidate.nflTeam,

    gameId: candidate.gameId,
    opponentNFLTeam:
      candidate.opponentNFLTeam,

    statValue: candidate.statValue,

    weeklyCorrectPicks:
      candidate.weeklyCorrectPicks,

    leaguePoints:
      candidate.leaguePoints,

    assignedNFLTeamWon:
      candidate.assignedNFLTeamWon,

    resolutionMethod,
  };
}

function createResultBase(
  season: number,
  week: number,
  rule: ObscureStatRule,
): ObscureStatAwardResult {
  return {
    id: getObscureStatAwardId(
      season,
      week,
    ),

    season,
    week,

    rule,

    status:
      rule.status === "no-award"
        ? "no-award"
        : "pending",

    pendingReason: null,

    candidates: [],

    winner: null,

    tiedPlayerIds: [],
    coinFlipPlayerIds: [],

    eligiblePlayerCount: 0,
    unavailablePlayerCount: 0,

    weeklyScoringFinalized: false,
    allRequiredGameStatsFinal: false,
  };
}

export function buildObscureStatAwardResult({
  players,
  nflGames,
  gameStatsById,
  scoringHistory,
  season,
  week,
}: BuildObscureStatAwardResultParams):
  ObscureStatAwardResult {
  const rule = getObscureStatRule(week);

  const resultBase =
    createResultBase(
      season,
      week,
      rule,
    );

  if (
    rule.status === "no-award" ||
    !rule.metric ||
    !rule.direction
  ) {
    return {
      ...resultBase,
      status: "no-award",
      allRequiredGameStatsFinal: true,
    };
  }

  const activePlayers =
    players.filter(
      (player) =>
        player.status === "active",
    );

  if (activePlayers.length === 0) {
    return {
      ...resultBase,
      status: "unavailable",
      allRequiredGameStatsFinal: true,
    };
  }

  const weeklyScoringRecordId =
    getWeeklyScoringRecordId(
      season,
      week,
    );

  const weeklyScoringRecord =
    scoringHistory[
      weeklyScoringRecordId
    ];

  const weeklyScoringFinalized =
    Boolean(weeklyScoringRecord);

  const seasonScoringSummaries =
    buildSeasonPlayerScoringSummaries({
      players: activePlayers,
      scoringHistory,
      season,
      throughWeek: week,
    });

  const internalCandidates =
    activePlayers.map((player) => {
      const weeklyPlayerResult =
        weeklyScoringRecord
          ?.playerResults[player.id];

      const seasonSummary =
        seasonScoringSummaries[
          player.id
        ];

      return buildCandidate(
        player,
        nflGames,
        gameStatsById,
        rule,
        season,
        week,
        weeklyPlayerResult
          ?.correctPicks ?? null,
        seasonSummary
          ?.leaguePoints ?? 0,
      );
    });

  const allRequiredGameStatsFinal =
    internalCandidates.every(
      (internalCandidate) =>
        internalCandidate
          .requiredGameStatsFinal,
    );

  const rankedCandidates =
    assignPrimaryRanks(
      internalCandidates.map(
        (internalCandidate) =>
          internalCandidate.candidate,
      ),
      rule.direction,
    );

  const eligibleCandidates =
    rankedCandidates.filter(
      (candidate) =>
        candidate.eligibility ===
        "eligible",
    );

  const unavailableCandidates =
    rankedCandidates.filter(
      (candidate) =>
        candidate.eligibility !==
        "eligible",
    );

  const commonResult = {
    ...resultBase,

    candidates: rankedCandidates,

    eligiblePlayerCount:
      eligibleCandidates.length,

    unavailablePlayerCount:
      unavailableCandidates.length,

    weeklyScoringFinalized,
    allRequiredGameStatsFinal,
  };

  if (!allRequiredGameStatsFinal) {
    return {
      ...commonResult,
      status: "pending",
      pendingReason:
        "game-stats-incomplete",
    };
  }

  const hasUnavailableFinalStat =
    rankedCandidates.some(
      (candidate) =>
        candidate.eligibility ===
        "stat-unavailable",
    );

  if (
    hasUnavailableFinalStat ||
    eligibleCandidates.length === 0
  ) {
    return {
      ...commonResult,
      status: "unavailable",
      pendingReason: null,
    };
  }

  if (!weeklyScoringFinalized) {
    return {
      ...commonResult,
      status: "pending",
      pendingReason:
        "weekly-scoring-not-final",
    };
  }

  const hasMissingWeeklyPickScore =
    eligibleCandidates.some(
      (candidate) =>
        candidate.weeklyCorrectPicks ===
        null,
    );

  if (hasMissingWeeklyPickScore) {
    return {
      ...commonResult,
      status: "unavailable",
      pendingReason: null,
    };
  }

  const resolvableCandidates =
    rankedCandidates.filter(
      isResolvableCandidate,
    );

  const primaryLeaders =
    resolvableCandidates.filter(
      (candidate) =>
        candidate.primaryRank === 1,
    );

  if (primaryLeaders.length === 0) {
    return {
      ...commonResult,
      status: "unavailable",
      pendingReason: null,
    };
  }

  if (primaryLeaders.length === 1) {
    return {
      ...commonResult,

      status: "resolved",

      winner: createWinner(
        primaryLeaders[0],
        "stat-value",
      ),
    };
  }

  const tiedPlayerIds =
    primaryLeaders.map(
      (candidate) =>
        candidate.playerId,
    );

  let remainingCandidates =
    keepMaximumCandidates(
      primaryLeaders,
      (candidate) =>
        candidate.weeklyCorrectPicks,
    );

  if (remainingCandidates.length === 1) {
    return {
      ...commonResult,

      status: "resolved",

      winner: createWinner(
        remainingCandidates[0],
        "weekly-correct-picks",
      ),

      tiedPlayerIds,
    };
  }

  remainingCandidates =
    keepMaximumCandidates(
      remainingCandidates,
      (candidate) =>
        candidate.leaguePoints,
    );

  if (remainingCandidates.length === 1) {
    return {
      ...commonResult,

      status: "resolved",

      winner: createWinner(
        remainingCandidates[0],
        "league-points",
      ),

      tiedPlayerIds,
    };
  }

  const assignedTeamWinners =
    remainingCandidates.filter(
      (candidate) =>
        candidate.assignedNFLTeamWon ===
        true,
    );

  if (assignedTeamWinners.length === 1) {
    return {
      ...commonResult,

      status: "resolved",

      winner: createWinner(
        assignedTeamWinners[0],
        "assigned-nfl-team-win",
      ),

      tiedPlayerIds,
    };
  }

  if (assignedTeamWinners.length > 1) {
    remainingCandidates =
      assignedTeamWinners;
  }

  const coinFlipPlayerIds =
    remainingCandidates
      .map(
        (candidate) =>
          candidate.playerId,
      )
      .sort();

  return {
    ...commonResult,

    status: "coin-flip-required",

    tiedPlayerIds,
    coinFlipPlayerIds,
  };
}
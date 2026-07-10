import type {
  ObscureStatAwardCandidate,
  ObscureStatAwardResult,
  ObscureStatAwardWinner,
} from "./obscureStatAwardTypes";
import {
  getObscureStatCoinFlipId,
  type ObscureStatCoinFlipResolution,
} from "./obscureStatCoinFlipTypes";

type CreateCoinFlipResolutionParams = {
  result: ObscureStatAwardResult;
  winnerPlayerId: string;
  resolvedAt?: string;
};

function normalizePlayerIds(
  playerIds: readonly string[],
): string[] {
  return Array.from(
    new Set(
      playerIds
        .map((playerId) => playerId.trim())
        .filter(Boolean),
    ),
  ).sort();
}

function haveMatchingPlayerIds(
  playerIdsA: readonly string[],
  playerIdsB: readonly string[],
): boolean {
  const normalizedA =
    normalizePlayerIds(playerIdsA);

  const normalizedB =
    normalizePlayerIds(playerIdsB);

  return (
    normalizedA.length ===
      normalizedB.length &&
    normalizedA.every(
      (playerId, index) =>
        playerId === normalizedB[index],
    )
  );
}

function isCompleteWinningCandidate(
  candidate:
    | ObscureStatAwardCandidate
    | undefined,
): candidate is ObscureStatAwardCandidate & {
  gameId: string;
  opponentNFLTeam: string;
  statValue: number;
  weeklyCorrectPicks: number;
} {
  return (
    Boolean(candidate) &&
    candidate?.eligibility === "eligible" &&
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

function createCoinFlipWinner(
  candidate: ObscureStatAwardCandidate & {
    gameId: string;
    opponentNFLTeam: string;
    statValue: number;
    weeklyCorrectPicks: number;
  },
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

    leaguePoints: candidate.leaguePoints,

    assignedNFLTeamWon:
      candidate.assignedNFLTeamWon,

    resolutionMethod:
      "offline-coin-flip",
  };
}

export function createObscureStatCoinFlipResolution({
  result,
  winnerPlayerId,
  resolvedAt = new Date().toISOString(),
}: CreateCoinFlipResolutionParams):
  ObscureStatCoinFlipResolution {
  if (
    result.status !==
    "coin-flip-required"
  ) {
    throw new Error(
      "This obscure-stat award does not require a coin flip.",
    );
  }

  const eligiblePlayerIds =
    normalizePlayerIds(
      result.coinFlipPlayerIds,
    );

  const normalizedWinnerPlayerId =
    winnerPlayerId.trim();

  if (
    !normalizedWinnerPlayerId ||
    !eligiblePlayerIds.includes(
      normalizedWinnerPlayerId,
    )
  ) {
    throw new Error(
      "The selected coin-flip winner is not an eligible finalist.",
    );
  }

  return {
    id: getObscureStatCoinFlipId(
      result.season,
      result.week,
    ),

    season: result.season,
    week: result.week,

    winnerPlayerId:
      normalizedWinnerPlayerId,

    eligiblePlayerIds,

    resolvedAt,
  };
}

export function isObscureStatCoinFlipResolutionApplicable(
  result: ObscureStatAwardResult,
  resolution:
    | ObscureStatCoinFlipResolution
    | null
    | undefined,
): resolution is ObscureStatCoinFlipResolution {
  if (
    !resolution ||
    result.status !==
      "coin-flip-required"
  ) {
    return false;
  }

  const expectedId =
    getObscureStatCoinFlipId(
      result.season,
      result.week,
    );

  if (
    resolution.id !== expectedId ||
    resolution.season !== result.season ||
    resolution.week !== result.week
  ) {
    return false;
  }

  if (
    !result.coinFlipPlayerIds.includes(
      resolution.winnerPlayerId,
    )
  ) {
    return false;
  }

  return haveMatchingPlayerIds(
    result.coinFlipPlayerIds,
    resolution.eligiblePlayerIds,
  );
}

export function applyObscureStatCoinFlipResolution(
  result: ObscureStatAwardResult,
  resolution:
    | ObscureStatCoinFlipResolution
    | null
    | undefined,
): ObscureStatAwardResult {
  if (
    !isObscureStatCoinFlipResolutionApplicable(
      result,
      resolution,
    )
  ) {
    return result;
  }

  const winningCandidate =
    result.candidates.find(
      (candidate) =>
        candidate.playerId ===
        resolution.winnerPlayerId,
    );

  if (
    !isCompleteWinningCandidate(
      winningCandidate,
    )
  ) {
    return result;
  }

  return {
    ...result,

    status: "resolved",
    pendingReason: null,

    winner: createCoinFlipWinner(
      winningCandidate,
    ),

    coinFlipPlayerIds: [],
  };
}
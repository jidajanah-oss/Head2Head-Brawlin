import {
  getSeasonAwardCoinFlipId,
  type SeasonAwardCandidate,
  type SeasonAwardCoinFlipResolution,
  type SeasonAwardResult,
  type SeasonAwardWinner,
} from "./seasonAwardTypes";

type CreateSeasonAwardCoinFlipResolutionParams = {
  result: SeasonAwardResult;
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
  const normalizedA = normalizePlayerIds(playerIdsA);
  const normalizedB = normalizePlayerIds(playerIdsB);

  return (
    normalizedA.length === normalizedB.length &&
    normalizedA.every(
      (playerId, index) => playerId === normalizedB[index],
    )
  );
}

function createCoinFlipWinner(
  candidate: SeasonAwardCandidate,
): SeasonAwardWinner {
  return {
    ...candidate,
    resolutionMethod: "offline-coin-flip",
  };
}

export function createSeasonAwardCoinFlipResolution({
  result,
  winnerPlayerId,
  resolvedAt = new Date().toISOString(),
}: CreateSeasonAwardCoinFlipResolutionParams): SeasonAwardCoinFlipResolution {
  if (result.status !== "coin-flip-required") {
    throw new Error(
      "This season award does not require a coin flip.",
    );
  }

  const eligiblePlayerIds = normalizePlayerIds(
    result.coinFlipPlayerIds,
  );

  const normalizedWinnerPlayerId = winnerPlayerId.trim();

  if (
    !normalizedWinnerPlayerId ||
    !eligiblePlayerIds.includes(normalizedWinnerPlayerId)
  ) {
    throw new Error(
      "The selected coin-flip winner is not an eligible finalist.",
    );
  }

  return {
    id: getSeasonAwardCoinFlipId(
      result.season,
      result.category,
    ),
    season: result.season,
    category: result.category,
    winnerPlayerId: normalizedWinnerPlayerId,
    eligiblePlayerIds,
    resolvedAt,
  };
}

export function isSeasonAwardCoinFlipResolutionApplicable(
  result: SeasonAwardResult,
  resolution: SeasonAwardCoinFlipResolution | null | undefined,
): resolution is SeasonAwardCoinFlipResolution {
  if (
    !resolution ||
    result.status !== "coin-flip-required"
  ) {
    return false;
  }

  const expectedId = getSeasonAwardCoinFlipId(
    result.season,
    result.category,
  );

  if (
    resolution.id !== expectedId ||
    resolution.season !== result.season ||
    resolution.category !== result.category
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

export function applySeasonAwardCoinFlipResolution(
  result: SeasonAwardResult,
  resolution: SeasonAwardCoinFlipResolution | null | undefined,
): SeasonAwardResult {
  if (
    !isSeasonAwardCoinFlipResolutionApplicable(
      result,
      resolution,
    )
  ) {
    return result;
  }

  const winningCandidate = result.candidates.find(
    (candidate) =>
      candidate.playerId === resolution.winnerPlayerId,
  );

  if (!winningCandidate) {
    return result;
  }

  return {
    ...result,
    status: "resolved",
    leadingPlayerIds: [winningCandidate.playerId],
    coinFlipPlayerIds: [],
    winner: createCoinFlipWinner(winningCandidate),
    pendingReason: null,
  };
}

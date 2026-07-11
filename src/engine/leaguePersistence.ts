import type {
  ObscureStatCoinFlipHistory,
  ObscureStatCoinFlipResolution,
} from "./obscureStatCoinFlipTypes";
import type {
  PayoutLedgerCategory,
  PayoutLedgerDirection,
  PayoutLedgerEntry,
  PayoutLedgerEntryOrigin,
  PayoutLedgerEntryStatus,
  PayoutLedgerHistory,
  PayoutLedgerPlayerSnapshot,
  PayoutLedgerSeasonState,
} from "./payoutLedgerTypes";
import type {
  PlayoffConference,
  PlayoffMatchupRecord,
  PlayoffMatchupStatus,
  PlayoffParticipantSnapshot,
  PlayoffResultSource,
  PlayoffResultsHistory,
  PlayoffRound,
  PlayoffSeasonState,
  PlayoffSeasonStatus,
} from "./playoffResultsTypes";
import type {
  PickerClickerAssignment,
  PickerClickerFallbackPick,
  PickerClickerFallbackStatus,
  PickerClickerHistory,
  PickerClickerWeekFallbacks,
  PickerClickerWeekState,
} from "./pickerClickerTypes";
import type {
  FinalizedWeeklyMatchupRecord,
  FinalizedWeeklyScoringRecord,
  WeeklyPlayerScoringResult,
  WeeklyScoringHistory,
  WeeklyScoringMatchupStatus,
  WeeklyScoringMatchupType,
  WeeklyScoringOutcome,
} from "./weeklyScoringTypes";
import type {
  PlayerRole,
  PlayerStatus,
} from "../types/player";

export type PersistedPicks = Record<
  string,
  Record<string, string>
>;

export type PersistedGameResults = Record<
  string,
  string
>;

export type LeaguePersistenceState<TLeague> = {
  league: TLeague;
  picks: PersistedPicks;
  activePlayerId: string;
  gameResults: PersistedGameResults;
  scoringHistory: WeeklyScoringHistory;
  pickerClickerHistory: PickerClickerHistory;
  obscureStatCoinFlipHistory: ObscureStatCoinFlipHistory;
  payoutLedgerHistory: PayoutLedgerHistory;
  playoffResultsHistory: PlayoffResultsHistory;
};

type StoredLeagueSnapshot<TLeague> =
  LeaguePersistenceState<TLeague> & {
    schemaVersion: number;
    savedAt: string;
  };

const STORAGE_KEY =
  "head2head-brawlin-steel.league.v1";

const SCHEMA_VERSION = 6;

function isBrowserStorageAvailable() {
  return (
    typeof window !== "undefined" &&
    typeof window.localStorage !== "undefined"
  );
}

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function sanitizeString(
  value: unknown,
  fallback = "",
): string {
  return typeof value === "string"
    ? value
    : fallback;
}

function sanitizeNullableString(
  value: unknown,
): string | null {
  return typeof value === "string"
    ? value
    : null;
}

function sanitizeNumber(
  value: unknown,
  fallback = 0,
): number {
  return typeof value === "number" &&
    Number.isFinite(value)
    ? value
    : fallback;
}

function sanitizeOptionalNumber(
  value: unknown,
): number | undefined {
  return typeof value === "number" &&
    Number.isFinite(value)
    ? value
    : undefined;
}

function sanitizeInteger(
  value: unknown,
  fallback = 0,
): number {
  const numericValue = sanitizeNumber(
    value,
    fallback,
  );

  return Math.trunc(numericValue);
}

function sanitizePositiveInteger(
  value: unknown,
  fallback = 0,
): number {
  const numericValue = sanitizeNumber(
    value,
    fallback,
  );

  if (numericValue <= 0) {
    return fallback;
  }

  return Math.trunc(numericValue);
}

function sanitizeBoolean(
  value: unknown,
  fallback = false,
): boolean {
  return typeof value === "boolean"
    ? value
    : fallback;
}

function sanitizeOptionalBoolean(
  value: unknown,
): boolean | undefined {
  return typeof value === "boolean"
    ? value
    : undefined;
}

function sanitizeStringArray(
  value: unknown,
): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value.filter(
        (item): item is string =>
          typeof item === "string" &&
          item.trim().length > 0,
      ),
    ),
  );
}

function sanitizeStringRecord(
  value: unknown,
): Record<string, string> {
  if (!isRecord(value)) {
    return {};
  }

  return Object.entries(value).reduce<
    Record<string, string>
  >((cleaned, [key, recordValue]) => {
    if (typeof recordValue === "string") {
      cleaned[key] = recordValue;
    }

    return cleaned;
  }, {});
}

function sanitizePicks(
  value: unknown,
): PersistedPicks {
  if (!isRecord(value)) {
    return {};
  }

  return Object.entries(value).reduce<
    PersistedPicks
  >((cleaned, [playerId, playerPicks]) => {
    const cleanPlayerPicks =
      sanitizeStringRecord(playerPicks);

    if (
      Object.keys(cleanPlayerPicks).length > 0
    ) {
      cleaned[playerId] = cleanPlayerPicks;
    }

    return cleaned;
  }, {});
}

function sanitizeWeeklyScoringOutcome(
  value: unknown,
): WeeklyScoringOutcome | null {
  if (
    value === "win" ||
    value === "loss" ||
    value === "tie" ||
    value === "bye" ||
    value === "open"
  ) {
    return value;
  }

  return null;
}

function sanitizeWeeklyScoringMatchupType(
  value: unknown,
): WeeklyScoringMatchupType | null {
  if (
    value === "owned-opponent" ||
    value === "open-opponent" ||
    value === "bye"
  ) {
    return value;
  }

  return null;
}

function sanitizeWeeklyScoringMatchupStatus(
  value: unknown,
): WeeklyScoringMatchupStatus | null {
  if (
    value === "final" ||
    value === "bye" ||
    value === "open"
  ) {
    return value;
  }

  return null;
}

function sanitizeWeeklyPlayerScoringResult(
  value: unknown,
): WeeklyPlayerScoringResult | null {
  if (!isRecord(value)) {
    return null;
  }

  const outcome =
    sanitizeWeeklyScoringOutcome(value.outcome);
  const matchupType =
    sanitizeWeeklyScoringMatchupType(
      value.matchupType,
    );

  if (
    !outcome ||
    !matchupType ||
    typeof value.playerId !== "string" ||
    typeof value.playerName !== "string" ||
    typeof value.nflTeam !== "string" ||
    typeof value.matchupId !== "string" ||
    typeof value.opponentName !== "string"
  ) {
    return null;
  }

  const seasonEligibleCorrectPicks =
    sanitizeOptionalNumber(
      value.seasonEligibleCorrectPicks,
    );
  const weeklyPrizeEligible =
    sanitizeOptionalBoolean(
      value.weeklyPrizeEligible,
    );
  const usedPickerClicker =
    sanitizeOptionalBoolean(
      value.usedPickerClicker,
    );
  const pickerClickerFallbackCount =
    sanitizeOptionalNumber(
      value.pickerClickerFallbackCount,
    );

  return {
    playerId: value.playerId,
    playerName: value.playerName,
    nflTeam: value.nflTeam,
    matchupId: value.matchupId,
    matchupType,
    opponentId: sanitizeNullableString(
      value.opponentId,
    ),
    opponentName: value.opponentName,
    correctPicks: sanitizeNumber(
      value.correctPicks,
    ),
    possiblePicks: sanitizeNumber(
      value.possiblePicks,
    ),
    missingPicks: sanitizeNumber(
      value.missingPicks,
    ),
    ...(seasonEligibleCorrectPicks !== undefined
      ? { seasonEligibleCorrectPicks }
      : {}),
    ...(weeklyPrizeEligible !== undefined
      ? { weeklyPrizeEligible }
      : {}),
    ...(usedPickerClicker !== undefined
      ? { usedPickerClicker }
      : {}),
    ...(pickerClickerFallbackCount !== undefined
      ? { pickerClickerFallbackCount }
      : {}),
    outcome,
    leaguePointsAwarded: sanitizeNumber(
      value.leaguePointsAwarded,
    ),
  };
}

function sanitizePlayerResults(
  value: unknown,
): Record<string, WeeklyPlayerScoringResult> {
  if (!isRecord(value)) {
    return {};
  }

  return Object.entries(value).reduce<
    Record<string, WeeklyPlayerScoringResult>
  >((cleaned, [playerId, playerResult]) => {
    const sanitizedResult =
      sanitizeWeeklyPlayerScoringResult(
        playerResult,
      );

    if (sanitizedResult) {
      cleaned[playerId] = sanitizedResult;
    }

    return cleaned;
  }, {});
}

function sanitizeFinalizedWeeklyMatchupRecord(
  value: unknown,
): FinalizedWeeklyMatchupRecord | null {
  if (!isRecord(value)) {
    return null;
  }

  const matchupType =
    sanitizeWeeklyScoringMatchupType(
      value.matchupType,
    );
  const status =
    sanitizeWeeklyScoringMatchupStatus(
      value.status,
    );

  if (
    !matchupType ||
    !status ||
    typeof value.id !== "string" ||
    typeof value.matchupId !== "string" ||
    typeof value.playerAId !== "string" ||
    typeof value.playerAName !== "string" ||
    typeof value.playerATeam !== "string" ||
    typeof value.resultLabel !== "string"
  ) {
    return null;
  }

  const sourceGameId =
    typeof value.sourceGameId === "string"
      ? value.sourceGameId
      : undefined;

  return {
    id: value.id,
    season: sanitizePositiveInteger(
      value.season,
    ),
    week: sanitizePositiveInteger(
      value.week,
    ),
    matchupId: value.matchupId,
    matchupType,
    ...(sourceGameId
      ? { sourceGameId }
      : {}),
    playerAId: value.playerAId,
    playerAName: value.playerAName,
    playerATeam: value.playerATeam,
    playerBId: sanitizeNullableString(
      value.playerBId,
    ),
    playerBName: sanitizeNullableString(
      value.playerBName,
    ),
    playerBTeam: sanitizeNullableString(
      value.playerBTeam,
    ),
    playerAScore: sanitizeNumber(
      value.playerAScore,
    ),
    playerBScore: sanitizeNumber(
      value.playerBScore,
    ),
    possiblePoints: sanitizeNumber(
      value.possiblePoints,
    ),
    winnerId: sanitizeNullableString(
      value.winnerId,
    ),
    isTie: sanitizeBoolean(value.isTie),
    status,
    resultLabel: value.resultLabel,
  };
}

function sanitizeFinalizedWeeklyMatchups(
  value: unknown,
): FinalizedWeeklyMatchupRecord[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.reduce<
    FinalizedWeeklyMatchupRecord[]
  >((cleaned, matchup) => {
    const sanitizedMatchup =
      sanitizeFinalizedWeeklyMatchupRecord(
        matchup,
      );

    if (sanitizedMatchup) {
      cleaned.push(sanitizedMatchup);
    }

    return cleaned;
  }, []);
}

function sanitizeFinalizedWeeklyScoringRecord(
  value: unknown,
  fallbackId: string,
): FinalizedWeeklyScoringRecord | null {
  if (!isRecord(value)) {
    return null;
  }

  const season = sanitizePositiveInteger(
    value.season,
  );
  const week = sanitizePositiveInteger(
    value.week,
  );

  if (season <= 0 || week <= 0) {
    return null;
  }

  return {
    id: sanitizeString(value.id, fallbackId),
    season,
    week,
    finalizedAt: sanitizeString(
      value.finalizedAt,
    ),
    totalScheduledGames: sanitizeNumber(
      value.totalScheduledGames,
    ),
    completedGameCount: sanitizeNumber(
      value.completedGameCount,
    ),
    canceledGameCount: sanitizeNumber(
      value.canceledGameCount,
    ),
    eligibleScoringGameCount: sanitizeNumber(
      value.eligibleScoringGameCount,
    ),
    completedGameIds: sanitizeStringArray(
      value.completedGameIds,
    ),
    canceledGameIds: sanitizeStringArray(
      value.canceledGameIds,
    ),
    matchups: sanitizeFinalizedWeeklyMatchups(
      value.matchups,
    ),
    playerResults: sanitizePlayerResults(
      value.playerResults,
    ),
  };
}

function sanitizeWeeklyScoringHistory(
  value: unknown,
): WeeklyScoringHistory {
  if (!isRecord(value)) {
    return {};
  }

  return Object.entries(value).reduce<
    WeeklyScoringHistory
  >((cleaned, [recordId, recordValue]) => {
    const sanitizedRecord =
      sanitizeFinalizedWeeklyScoringRecord(
        recordValue,
        recordId,
      );

    if (sanitizedRecord) {
      cleaned[sanitizedRecord.id] =
        sanitizedRecord;
    }

    return cleaned;
  }, {});
}

function sanitizePickerClickerFallbackStatus(
  value: unknown,
): PickerClickerFallbackStatus | null {
  if (
    value === "copied" ||
    value === "no-source-pick"
  ) {
    return value;
  }

  return null;
}

function sanitizePickerClickerAssignment(
  value: unknown,
): PickerClickerAssignment | null {
  if (!isRecord(value)) {
    return null;
  }

  const season = sanitizePositiveInteger(
    value.season,
  );
  const week = sanitizePositiveInteger(
    value.week,
  );
  const cycleNumber = sanitizePositiveInteger(
    value.cycleNumber,
    1,
  );

  if (
    season <= 0 ||
    week <= 0 ||
    typeof value.id !== "string" ||
    typeof value.sourcePlayerId !== "string" ||
    typeof value.sourcePlayerName !== "string" ||
    typeof value.sourceNFLTeam !== "string"
  ) {
    return null;
  }

  return {
    id: value.id,
    season,
    week,
    sourcePlayerId: value.sourcePlayerId,
    sourcePlayerName: value.sourcePlayerName,
    sourceNFLTeam: value.sourceNFLTeam,
    cycleNumber,
    assignedAt: sanitizeString(
      value.assignedAt,
    ),
  };
}

function sanitizePickerClickerFallbackPick(
  value: unknown,
): PickerClickerFallbackPick | null {
  if (!isRecord(value)) {
    return null;
  }

  const status =
    sanitizePickerClickerFallbackStatus(
      value.status,
    );
  const season = sanitizePositiveInteger(
    value.season,
  );
  const week = sanitizePositiveInteger(
    value.week,
  );

  if (
    !status ||
    season <= 0 ||
    week <= 0 ||
    typeof value.id !== "string" ||
    typeof value.gameId !== "string" ||
    typeof value.playerId !== "string" ||
    typeof value.sourcePlayerId !== "string"
  ) {
    return null;
  }

  const team = sanitizeNullableString(
    value.team,
  );

  if (status === "copied" && !team) {
    return null;
  }

  return {
    id: value.id,
    season,
    week,
    gameId: value.gameId,
    playerId: value.playerId,
    sourcePlayerId: value.sourcePlayerId,
    team:
      status === "copied"
        ? team
        : null,
    status,
    appliedAt: sanitizeString(
      value.appliedAt,
    ),
  };
}

function sanitizePickerClickerWeekFallbacks(
  value: unknown,
): PickerClickerWeekFallbacks {
  if (!isRecord(value)) {
    return {};
  }

  return Object.entries(value).reduce<
    PickerClickerWeekFallbacks
  >(
    (
      cleanedPlayers,
      [playerId, playerFallbacks],
    ) => {
      if (!isRecord(playerFallbacks)) {
        return cleanedPlayers;
      }

      const cleanPlayerFallbacks =
        Object.entries(playerFallbacks).reduce<
          Record<
            string,
            PickerClickerFallbackPick
          >
        >(
          (
            cleanedGames,
            [gameId, fallbackValue],
          ) => {
            const sanitizedFallback =
              sanitizePickerClickerFallbackPick(
                fallbackValue,
              );

            if (sanitizedFallback) {
              cleanedGames[gameId] =
                sanitizedFallback;
            }

            return cleanedGames;
          },
          {},
        );

      if (
        Object.keys(cleanPlayerFallbacks)
          .length > 0
      ) {
        cleanedPlayers[playerId] =
          cleanPlayerFallbacks;
      }

      return cleanedPlayers;
    },
    {},
  );
}

function sanitizePickerClickerWeekState(
  value: unknown,
  fallbackId: string,
): PickerClickerWeekState | null {
  if (!isRecord(value)) {
    return null;
  }

  const assignment =
    sanitizePickerClickerAssignment(
      value.assignment,
    );
  const season = sanitizePositiveInteger(
    value.season,
  );
  const week = sanitizePositiveInteger(
    value.week,
  );

  if (
    !assignment ||
    season <= 0 ||
    week <= 0 ||
    assignment.season !== season ||
    assignment.week !== week
  ) {
    return null;
  }

  return {
    id: sanitizeString(value.id, fallbackId),
    season,
    week,
    assignment,
    fallbackPicks:
      sanitizePickerClickerWeekFallbacks(
        value.fallbackPicks,
      ),
    ineligiblePlayerIds: sanitizeStringArray(
      value.ineligiblePlayerIds,
    ),
    lockedGameIds: sanitizeStringArray(
      value.lockedGameIds,
    ),
    updatedAt: sanitizeString(
      value.updatedAt,
      assignment.assignedAt,
    ),
  };
}

function sanitizePickerClickerHistory(
  value: unknown,
): PickerClickerHistory {
  if (!isRecord(value)) {
    return {};
  }

  return Object.entries(value).reduce<
    PickerClickerHistory
  >((cleaned, [weekStateId, weekStateValue]) => {
    const sanitizedWeekState =
      sanitizePickerClickerWeekState(
        weekStateValue,
        weekStateId,
      );

    if (sanitizedWeekState) {
      cleaned[sanitizedWeekState.id] =
        sanitizedWeekState;
    }

    return cleaned;
  }, {});
}

function sanitizeObscureStatCoinFlipResolution(
  value: unknown,
  fallbackId: string,
): ObscureStatCoinFlipResolution | null {
  if (!isRecord(value)) {
    return null;
  }

  const season = sanitizePositiveInteger(
    value.season,
  );
  const week = sanitizePositiveInteger(
    value.week,
  );
  const winnerPlayerId = sanitizeString(
    value.winnerPlayerId,
  ).trim();
  const eligiblePlayerIds =
    sanitizeStringArray(
      value.eligiblePlayerIds,
    )
      .map((playerId) => playerId.trim())
      .filter(Boolean)
      .sort();

  if (
    season <= 0 ||
    week <= 0 ||
    !winnerPlayerId ||
    eligiblePlayerIds.length < 2 ||
    !eligiblePlayerIds.includes(
      winnerPlayerId,
    )
  ) {
    return null;
  }

  return {
    id: sanitizeString(value.id, fallbackId),
    season,
    week,
    winnerPlayerId,
    eligiblePlayerIds,
    resolvedAt: sanitizeString(
      value.resolvedAt,
    ),
  };
}

function sanitizeObscureStatCoinFlipHistory(
  value: unknown,
): ObscureStatCoinFlipHistory {
  if (!isRecord(value)) {
    return {};
  }

  return Object.entries(value).reduce<
    ObscureStatCoinFlipHistory
  >(
    (
      cleaned,
      [resolutionId, resolutionValue],
    ) => {
      const sanitizedResolution =
        sanitizeObscureStatCoinFlipResolution(
          resolutionValue,
          resolutionId,
        );

      if (sanitizedResolution) {
        cleaned[sanitizedResolution.id] =
          sanitizedResolution;
      }

      return cleaned;
    },
    {},
  );
}

function sanitizePlayerRole(
  value: unknown,
): PlayerRole | null {
  if (
    value === "commissioner" ||
    value === "backup_commissioner" ||
    value === "player"
  ) {
    return value;
  }

  return null;
}

function sanitizePlayerStatus(
  value: unknown,
): PlayerStatus | null {
  if (
    value === "active" ||
    value === "inactive"
  ) {
    return value;
  }

  return null;
}

function sanitizePayoutLedgerDirection(
  value: unknown,
): PayoutLedgerDirection | null {
  if (
    value === "collection" ||
    value === "payout"
  ) {
    return value;
  }

  return null;
}

function sanitizePayoutLedgerEntryStatus(
  value: unknown,
): PayoutLedgerEntryStatus | null {
  if (
    value === "unpaid" ||
    value === "paid"
  ) {
    return value;
  }

  return null;
}

function sanitizePayoutLedgerEntryOrigin(
  value: unknown,
): PayoutLedgerEntryOrigin | null {
  if (
    value === "automatic" ||
    value === "manual"
  ) {
    return value;
  }

  return null;
}

function sanitizePayoutLedgerCategory(
  value: unknown,
): PayoutLedgerCategory | null {
  if (
    value === "player-buy-in" ||
    value === "obscure-stat-award" ||
    value === "division-group-payout" ||
    value === "afc-winner" ||
    value === "nfc-winner" ||
    value === "wild-card-loser" ||
    value === "divisional-loser" ||
    value === "conference-loser" ||
    value === "super-bowl-loser" ||
    value === "super-bowl-winner" ||
    value === "biggest-winner" ||
    value === "biggest-loser" ||
    value === "last-to-lose" ||
    value === "adjustment"
  ) {
    return value;
  }

  return null;
}

function sanitizePayoutLedgerPlayerSnapshot(
  value: unknown,
): PayoutLedgerPlayerSnapshot | null {
  if (!isRecord(value)) {
    return null;
  }

  const status = sanitizePlayerStatus(
    value.status,
  );
  const role = sanitizePlayerRole(value.role);
  const playerId = sanitizeString(
    value.playerId,
  ).trim();
  const playerName = sanitizeString(
    value.playerName,
  ).trim();
  const nflTeam = sanitizeString(
    value.nflTeam,
  ).trim();

  if (
    !status ||
    !role ||
    !playerId ||
    !playerName ||
    !nflTeam
  ) {
    return null;
  }

  return {
    playerId,
    playerName,
    nflTeam,
    status,
    role,
    capturedAt: sanitizeString(
      value.capturedAt,
    ),
  };
}

function sanitizePayoutLedgerRoster(
  value: unknown,
): PayoutLedgerPlayerSnapshot[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const seenPlayerIds = new Set<string>();

  return value.reduce<
    PayoutLedgerPlayerSnapshot[]
  >((cleaned, rosterValue) => {
    const snapshot =
      sanitizePayoutLedgerPlayerSnapshot(
        rosterValue,
      );

    if (
      snapshot &&
      !seenPlayerIds.has(snapshot.playerId)
    ) {
      seenPlayerIds.add(snapshot.playerId);
      cleaned.push(snapshot);
    }

    return cleaned;
  }, []);
}

function sanitizePayoutLedgerEntry(
  value: unknown,
  fallbackId: string,
): PayoutLedgerEntry | null {
  if (!isRecord(value)) {
    return null;
  }

  const season = sanitizePositiveInteger(
    value.season,
  );
  const direction =
    sanitizePayoutLedgerDirection(
      value.direction,
    );
  const category =
    sanitizePayoutLedgerCategory(
      value.category,
    );
  const origin =
    sanitizePayoutLedgerEntryOrigin(
      value.origin,
    );
  const status =
    sanitizePayoutLedgerEntryStatus(
      value.status,
    );
  const amountCents = sanitizeInteger(
    value.amountCents,
  );
  const id = sanitizeString(
    value.id,
    fallbackId,
  ).trim();
  const playerId = sanitizeString(
    value.playerId,
  ).trim();
  const playerName = sanitizeString(
    value.playerName,
  ).trim();
  const nflTeam = sanitizeString(
    value.nflTeam,
  ).trim();
  const sourceKey = sanitizeString(
    value.sourceKey,
  ).trim();
  const sourceLabel = sanitizeString(
    value.sourceLabel,
  ).trim();

  if (
    season <= 0 ||
    !direction ||
    !category ||
    !origin ||
    !status ||
    amountCents <= 0 ||
    !id ||
    !playerId ||
    !playerName ||
    !nflTeam ||
    !sourceKey ||
    !sourceLabel
  ) {
    return null;
  }

  return {
    id,
    season,
    playerId,
    playerName,
    nflTeam,
    direction,
    category,
    origin,
    amountCents,
    status,
    sourceKey,
    sourceLabel,
    note: sanitizeString(value.note),
    createdAt: sanitizeString(
      value.createdAt,
    ),
    updatedAt: sanitizeString(
      value.updatedAt,
    ),
    paidAt:
      status === "paid"
        ? sanitizeNullableString(value.paidAt)
        : null,
    needsReview: sanitizeBoolean(
      value.needsReview,
    ),
  };
}

function sanitizePayoutLedgerEntries(
  value: unknown,
  season: number,
): Record<string, PayoutLedgerEntry> {
  if (!isRecord(value)) {
    return {};
  }

  return Object.entries(value).reduce<
    Record<string, PayoutLedgerEntry>
  >((cleaned, [entryId, entryValue]) => {
    const entry = sanitizePayoutLedgerEntry(
      entryValue,
      entryId,
    );

    if (entry && entry.season === season) {
      cleaned[entry.id] = entry;
    }

    return cleaned;
  }, {});
}

function sanitizePayoutLedgerSeasonState(
  value: unknown,
  fallbackId: string,
): PayoutLedgerSeasonState | null {
  if (!isRecord(value)) {
    return null;
  }

  const season = sanitizePositiveInteger(
    value.season,
  );

  if (season <= 0) {
    return null;
  }

  const id = sanitizeString(
    value.id,
    fallbackId,
  ).trim();

  if (!id) {
    return null;
  }

  return {
    id,
    season,
    initializedAt: sanitizeString(
      value.initializedAt,
    ),
    updatedAt: sanitizeString(
      value.updatedAt,
    ),
    roster: sanitizePayoutLedgerRoster(
      value.roster,
    ),
    entries: sanitizePayoutLedgerEntries(
      value.entries,
      season,
    ),
  };
}

function sanitizePayoutLedgerHistory(
  value: unknown,
): PayoutLedgerHistory {
  if (!isRecord(value)) {
    return {};
  }

  return Object.entries(value).reduce<
    PayoutLedgerHistory
  >((cleaned, [ledgerId, ledgerValue]) => {
    const ledger =
      sanitizePayoutLedgerSeasonState(
        ledgerValue,
        ledgerId,
      );

    if (ledger) {
      cleaned[ledger.id] = ledger;
    }

    return cleaned;
  }, {});
}

function sanitizePlayoffRound(
  value: unknown,
): PlayoffRound | null {
  if (
    value === "wildcard" ||
    value === "divisional" ||
    value === "conference-championship" ||
    value === "super-bowl"
  ) {
    return value;
  }

  return null;
}

function sanitizePlayoffConference(
  value: unknown,
): PlayoffConference | null {
  if (
    value === "AFC" ||
    value === "NFC" ||
    value === "NFL"
  ) {
    return value;
  }

  return null;
}

function sanitizePlayoffSeasonStatus(
  value: unknown,
): PlayoffSeasonStatus | null {
  if (
    value === "active" ||
    value === "complete"
  ) {
    return value;
  }

  return null;
}

function sanitizePlayoffMatchupStatus(
  value: unknown,
): PlayoffMatchupStatus | null {
  if (
    value === "waiting" ||
    value === "ready" ||
    value === "needs-resolution" ||
    value === "final"
  ) {
    return value;
  }

  return null;
}

function sanitizePlayoffResultSource(
  value: unknown,
): PlayoffResultSource | null {
  if (
    value === "score" ||
    value === "commissioner-tie-resolution"
  ) {
    return value;
  }

  return null;
}

function sanitizePlayoffParticipantSnapshot(
  value: unknown,
): PlayoffParticipantSnapshot | null {
  if (!isRecord(value)) {
    return null;
  }

  const conference =
    sanitizePlayoffConference(
      value.conference,
    );
  const playerId = sanitizeString(
    value.playerId,
  ).trim();
  const playerName = sanitizeString(
    value.playerName,
  ).trim();
  const nflTeam = sanitizeString(
    value.nflTeam,
  ).trim();
  const seed = sanitizePositiveInteger(
    value.seed,
  );

  if (
    (conference !== "AFC" &&
      conference !== "NFC") ||
    !playerId ||
    !playerName ||
    !nflTeam ||
    seed <= 0
  ) {
    return null;
  }

  return {
    playerId,
    playerName,
    nflTeam,
    conference,
    seed,
    regularSeasonLeaguePoints: Math.max(
      0,
      sanitizeInteger(
        value.regularSeasonLeaguePoints,
      ),
    ),
    regularSeasonWins: Math.max(
      0,
      sanitizeInteger(
        value.regularSeasonWins,
      ),
    ),
    regularSeasonLosses: Math.max(
      0,
      sanitizeInteger(
        value.regularSeasonLosses,
      ),
    ),
    regularSeasonTies: Math.max(
      0,
      sanitizeInteger(
        value.regularSeasonTies,
      ),
    ),
    regularSeasonCorrectPicks: Math.max(
      0,
      sanitizeInteger(
        value.regularSeasonCorrectPicks,
      ),
    ),
  };
}

function sanitizePlayoffParticipantList(
  value: unknown,
  conference: "AFC" | "NFC",
): PlayoffParticipantSnapshot[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const seenPlayerIds = new Set<string>();
  const seenSeeds = new Set<number>();

  return value
    .reduce<PlayoffParticipantSnapshot[]>(
      (cleaned, participantValue) => {
        const participant =
          sanitizePlayoffParticipantSnapshot(
            participantValue,
          );

        if (
          participant &&
          participant.conference === conference &&
          !seenPlayerIds.has(
            participant.playerId,
          ) &&
          !seenSeeds.has(participant.seed)
        ) {
          seenPlayerIds.add(
            participant.playerId,
          );
          seenSeeds.add(participant.seed);
          cleaned.push(participant);
        }

        return cleaned;
      },
      [],
    )
    .sort(
      (participantA, participantB) =>
        participantA.seed -
        participantB.seed,
    );
}

function sanitizeNullablePlayoffScore(
  value: unknown,
): number | null {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    !Number.isInteger(value) ||
    value < 0
  ) {
    return null;
  }

  return value;
}

function sanitizePlayoffMatchupSide(
  value: unknown,
): PlayoffMatchupRecord["teamA"] {
  if (!isRecord(value)) {
    return {
      participant: null,
      score: null,
    };
  }

  return {
    participant:
      sanitizePlayoffParticipantSnapshot(
        value.participant,
      ),
    score: sanitizeNullablePlayoffScore(
      value.score,
    ),
  };
}

function sanitizePlayoffMatchupRecord(
  value: unknown,
  fallbackId: string,
): PlayoffMatchupRecord | null {
  if (!isRecord(value)) {
    return null;
  }

  const season = sanitizePositiveInteger(
    value.season,
  );
  const round = sanitizePlayoffRound(
    value.round,
  );
  const conference =
    sanitizePlayoffConference(
      value.conference,
    );
  const status =
    sanitizePlayoffMatchupStatus(
      value.status,
    );
  const position = sanitizePositiveInteger(
    value.position,
  );
  const id = sanitizeString(
    value.id,
    fallbackId,
  ).trim();
  const title = sanitizeString(
    value.title,
  ).trim();
  const matchupLabel = sanitizeString(
    value.matchupLabel,
  ).trim();

  if (
    season <= 0 ||
    !round ||
    !conference ||
    !status ||
    position <= 0 ||
    !id ||
    !title ||
    !matchupLabel
  ) {
    return null;
  }

  if (
    round === "super-bowl"
      ? conference !== "NFL"
      : conference === "NFL"
  ) {
    return null;
  }

  const teamA = sanitizePlayoffMatchupSide(
    value.teamA,
  );
  const teamB = sanitizePlayoffMatchupSide(
    value.teamB,
  );
  const participantIds = new Set(
    [
      teamA.participant?.playerId,
      teamB.participant?.playerId,
    ].filter(
      (playerId): playerId is string =>
        Boolean(playerId),
    ),
  );
  const winnerId = sanitizeNullableString(
    value.winnerId,
  );
  const loserId = sanitizeNullableString(
    value.loserId,
  );

  return {
    id,
    season,
    round,
    conference,
    position,
    title,
    matchupLabel,
    teamA,
    teamB,
    status,
    winnerId:
      winnerId &&
      participantIds.has(winnerId)
        ? winnerId
        : null,
    loserId:
      loserId &&
      participantIds.has(loserId)
        ? loserId
        : null,
    isTie: sanitizeBoolean(value.isTie),
    resultSource:
      sanitizePlayoffResultSource(
        value.resultSource,
      ),
    finalizedAt: sanitizeNullableString(
      value.finalizedAt,
    ),
    updatedAt: sanitizeString(
      value.updatedAt,
    ),
    note: sanitizeString(value.note),
  };
}

function sanitizePlayoffMatchups(
  value: unknown,
  season: number,
): Record<string, PlayoffMatchupRecord> {
  if (!isRecord(value)) {
    return {};
  }

  return Object.entries(value).reduce<
    Record<string, PlayoffMatchupRecord>
  >((cleaned, [matchupId, matchupValue]) => {
    const matchup =
      sanitizePlayoffMatchupRecord(
        matchupValue,
        matchupId,
      );

    if (matchup && matchup.season === season) {
      cleaned[matchup.id] = matchup;
    }

    return cleaned;
  }, {});
}

function sanitizePlayoffSeasonState(
  value: unknown,
  fallbackId: string,
): PlayoffSeasonState | null {
  if (!isRecord(value)) {
    return null;
  }

  const season = sanitizePositiveInteger(
    value.season,
  );
  const status = sanitizePlayoffSeasonStatus(
    value.status,
  );
  const id = sanitizeString(
    value.id,
    fallbackId,
  ).trim();

  if (
    season <= 0 ||
    !status ||
    !id ||
    !isRecord(value.seeds)
  ) {
    return null;
  }

  const matchups = sanitizePlayoffMatchups(
    value.matchups,
    season,
  );

  return {
    id,
    season,
    status,
    initializedAt: sanitizeString(
      value.initializedAt,
    ),
    updatedAt: sanitizeString(
      value.updatedAt,
    ),
    seeds: {
      capturedAt: sanitizeString(
        value.seeds.capturedAt,
      ),
      AFC: sanitizePlayoffParticipantList(
        value.seeds.AFC,
        "AFC",
      ),
      NFC: sanitizePlayoffParticipantList(
        value.seeds.NFC,
        "NFC",
      ),
    },
    matchups,
    afcChampionId: sanitizeNullableString(
      value.afcChampionId,
    ),
    nfcChampionId: sanitizeNullableString(
      value.nfcChampionId,
    ),
    championId: sanitizeNullableString(
      value.championId,
    ),
  };
}

function sanitizePlayoffResultsHistory(
  value: unknown,
): PlayoffResultsHistory {
  if (!isRecord(value)) {
    return {};
  }

  return Object.entries(value).reduce<
    PlayoffResultsHistory
  >((cleaned, [seasonId, seasonValue]) => {
    const playoffSeason =
      sanitizePlayoffSeasonState(
        seasonValue,
        seasonId,
      );

    if (playoffSeason) {
      cleaned[playoffSeason.id] =
        playoffSeason;
    }

    return cleaned;
  }, {});
}

function mergeLeagueState<TLeague>(
  fallbackLeague: TLeague,
  persistedLeague: unknown,
): TLeague {
  if (
    !isRecord(fallbackLeague) ||
    !isRecord(persistedLeague)
  ) {
    return fallbackLeague;
  }

  return {
    ...fallbackLeague,
    ...persistedLeague,
  } as TLeague;
}

export function loadPersistedLeagueState<
  TLeague,
>(
  fallbackLeague: TLeague,
): LeaguePersistenceState<TLeague> {
  const fallbackState: LeaguePersistenceState<TLeague> = {
    league: fallbackLeague,
    picks: {},
    activePlayerId: "",
    gameResults: {},
    scoringHistory: {},
    pickerClickerHistory: {},
    obscureStatCoinFlipHistory: {},
    payoutLedgerHistory: {},
    playoffResultsHistory: {},
  };

  if (!isBrowserStorageAvailable()) {
    return fallbackState;
  }

  try {
    const rawSnapshot =
      window.localStorage.getItem(
        STORAGE_KEY,
      );

    if (!rawSnapshot) {
      return fallbackState;
    }

    const parsedSnapshot: unknown =
      JSON.parse(rawSnapshot);

    if (!isRecord(parsedSnapshot)) {
      return fallbackState;
    }

    return {
      league: mergeLeagueState(
        fallbackLeague,
        parsedSnapshot.league,
      ),
      picks: sanitizePicks(
        parsedSnapshot.picks,
      ),
      activePlayerId:
        typeof parsedSnapshot.activePlayerId ===
        "string"
          ? parsedSnapshot.activePlayerId
          : "",
      gameResults: sanitizeStringRecord(
        parsedSnapshot.gameResults,
      ),
      scoringHistory:
        sanitizeWeeklyScoringHistory(
          parsedSnapshot.scoringHistory,
        ),
      pickerClickerHistory:
        sanitizePickerClickerHistory(
          parsedSnapshot.pickerClickerHistory,
        ),
      obscureStatCoinFlipHistory:
        sanitizeObscureStatCoinFlipHistory(
          parsedSnapshot
            .obscureStatCoinFlipHistory,
        ),
      payoutLedgerHistory:
        sanitizePayoutLedgerHistory(
          parsedSnapshot.payoutLedgerHistory,
        ),
      playoffResultsHistory:
        sanitizePlayoffResultsHistory(
          parsedSnapshot.playoffResultsHistory,
        ),
    };
  } catch {
    return fallbackState;
  }
}

export function savePersistedLeagueState<
  TLeague,
>(
  state: LeaguePersistenceState<TLeague>,
): boolean {
  if (!isBrowserStorageAvailable()) {
    return false;
  }

  try {
    const snapshot: StoredLeagueSnapshot<TLeague> = {
      schemaVersion: SCHEMA_VERSION,
      savedAt: new Date().toISOString(),
      league: state.league,
      picks: state.picks,
      activePlayerId: state.activePlayerId,
      gameResults: state.gameResults,
      scoringHistory: state.scoringHistory,
      pickerClickerHistory:
        state.pickerClickerHistory,
      obscureStatCoinFlipHistory:
        state.obscureStatCoinFlipHistory,
      payoutLedgerHistory:
        state.payoutLedgerHistory,
      playoffResultsHistory:
        state.playoffResultsHistory,
    };

    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(snapshot),
    );

    return true;
  } catch {
    return false;
  }
}

export function clearPersistedLeagueState(): boolean {
  if (!isBrowserStorageAvailable()) {
    return false;
  }

  try {
    window.localStorage.removeItem(
      STORAGE_KEY,
    );

    return true;
  } catch {
    return false;
  }
}

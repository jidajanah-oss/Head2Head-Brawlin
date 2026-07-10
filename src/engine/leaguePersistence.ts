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

export type PersistedPicks = Record<
  string,
  Record<string, string>
>;

export type PersistedGameResults = Record<string, string>;

export type LeaguePersistenceState<TLeague> = {
  league: TLeague;
  picks: PersistedPicks;
  activePlayerId: string;
  gameResults: PersistedGameResults;
  scoringHistory: WeeklyScoringHistory;
  pickerClickerHistory: PickerClickerHistory;
};

type StoredLeagueSnapshot<TLeague> =
  LeaguePersistenceState<TLeague> & {
    schemaVersion: number;
    savedAt: string;
  };

const STORAGE_KEY =
  "head2head-brawlin-steel.league.v1";

const SCHEMA_VERSION = 3;

function isBrowserStorageAvailable() {
  return (
    typeof window !== "undefined" &&
    typeof window.localStorage !== "undefined"
  );
}

function isRecord(
  value: unknown
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function sanitizeString(
  value: unknown,
  fallback = ""
) {
  return typeof value === "string"
    ? value
    : fallback;
}

function sanitizeNullableString(value: unknown) {
  return typeof value === "string"
    ? value
    : null;
}

function sanitizeNumber(
  value: unknown,
  fallback = 0
) {
  return (
    typeof value === "number" &&
    Number.isFinite(value)
  )
    ? value
    : fallback;
}

function sanitizeOptionalNumber(
  value: unknown
): number | undefined {
  return (
    typeof value === "number" &&
    Number.isFinite(value)
  )
    ? value
    : undefined;
}

function sanitizePositiveInteger(
  value: unknown,
  fallback = 0
) {
  const numericValue = sanitizeNumber(
    value,
    fallback
  );

  if (numericValue <= 0) {
    return fallback;
  }

  return Math.trunc(numericValue);
}

function sanitizeBoolean(
  value: unknown,
  fallback = false
) {
  return typeof value === "boolean"
    ? value
    : fallback;
}

function sanitizeOptionalBoolean(
  value: unknown
): boolean | undefined {
  return typeof value === "boolean"
    ? value
    : undefined;
}

function sanitizeStringArray(
  value: unknown
): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value.filter(
        (item): item is string =>
          typeof item === "string"
      )
    )
  );
}

function sanitizeStringRecord(
  value: unknown
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
  value: unknown
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
      cleaned[playerId] =
        cleanPlayerPicks;
    }

    return cleaned;
  }, {});
}

function sanitizeWeeklyScoringOutcome(
  value: unknown
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
  value: unknown
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
  value: unknown
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
  value: unknown
): WeeklyPlayerScoringResult | null {
  if (!isRecord(value)) {
    return null;
  }

  const outcome =
    sanitizeWeeklyScoringOutcome(
      value.outcome
    );

  const matchupType =
    sanitizeWeeklyScoringMatchupType(
      value.matchupType
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
      value.seasonEligibleCorrectPicks
    );

  const weeklyPrizeEligible =
    sanitizeOptionalBoolean(
      value.weeklyPrizeEligible
    );

  const usedPickerClicker =
    sanitizeOptionalBoolean(
      value.usedPickerClicker
    );

  const pickerClickerFallbackCount =
    sanitizeOptionalNumber(
      value.pickerClickerFallbackCount
    );

  return {
    playerId: value.playerId,
    playerName: value.playerName,
    nflTeam: value.nflTeam,

    matchupId: value.matchupId,
    matchupType,

    opponentId:
      sanitizeNullableString(
        value.opponentId
      ),

    opponentName: value.opponentName,

    correctPicks:
      sanitizeNumber(
        value.correctPicks
      ),

    possiblePicks:
      sanitizeNumber(
        value.possiblePicks
      ),

    missingPicks:
      sanitizeNumber(
        value.missingPicks
      ),

    ...(seasonEligibleCorrectPicks !==
    undefined
      ? {
          seasonEligibleCorrectPicks,
        }
      : {}),

    ...(weeklyPrizeEligible !== undefined
      ? {
          weeklyPrizeEligible,
        }
      : {}),

    ...(usedPickerClicker !== undefined
      ? {
          usedPickerClicker,
        }
      : {}),

    ...(pickerClickerFallbackCount !==
    undefined
      ? {
          pickerClickerFallbackCount,
        }
      : {}),

    outcome,

    leaguePointsAwarded:
      sanitizeNumber(
        value.leaguePointsAwarded
      ),
  };
}

function sanitizePlayerResults(
  value: unknown
): Record<
  string,
  WeeklyPlayerScoringResult
> {
  if (!isRecord(value)) {
    return {};
  }

  return Object.entries(value).reduce<
    Record<
      string,
      WeeklyPlayerScoringResult
    >
  >((cleaned, [playerId, playerResult]) => {
    const sanitizedResult =
      sanitizeWeeklyPlayerScoringResult(
        playerResult
      );

    if (sanitizedResult) {
      cleaned[playerId] =
        sanitizedResult;
    }

    return cleaned;
  }, {});
}

function sanitizeFinalizedWeeklyMatchupRecord(
  value: unknown
): FinalizedWeeklyMatchupRecord | null {
  if (!isRecord(value)) {
    return null;
  }

  const matchupType =
    sanitizeWeeklyScoringMatchupType(
      value.matchupType
    );

  const status =
    sanitizeWeeklyScoringMatchupStatus(
      value.status
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

    season:
      sanitizePositiveInteger(
        value.season
      ),

    week:
      sanitizePositiveInteger(
        value.week
      ),

    matchupId: value.matchupId,
    matchupType,

    ...(sourceGameId
      ? {
          sourceGameId,
        }
      : {}),

    playerAId: value.playerAId,
    playerAName: value.playerAName,
    playerATeam: value.playerATeam,

    playerBId:
      sanitizeNullableString(
        value.playerBId
      ),

    playerBName:
      sanitizeNullableString(
        value.playerBName
      ),

    playerBTeam:
      sanitizeNullableString(
        value.playerBTeam
      ),

    playerAScore:
      sanitizeNumber(
        value.playerAScore
      ),

    playerBScore:
      sanitizeNumber(
        value.playerBScore
      ),

    possiblePoints:
      sanitizeNumber(
        value.possiblePoints
      ),

    winnerId:
      sanitizeNullableString(
        value.winnerId
      ),

    isTie:
      sanitizeBoolean(
        value.isTie
      ),

    status,
    resultLabel: value.resultLabel,
  };
}

function sanitizeFinalizedWeeklyMatchups(
  value: unknown
): FinalizedWeeklyMatchupRecord[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.reduce<
    FinalizedWeeklyMatchupRecord[]
  >((cleaned, matchup) => {
    const sanitizedMatchup =
      sanitizeFinalizedWeeklyMatchupRecord(
        matchup
      );

    if (sanitizedMatchup) {
      cleaned.push(sanitizedMatchup);
    }

    return cleaned;
  }, []);
}

function sanitizeFinalizedWeeklyScoringRecord(
  value: unknown,
  fallbackId: string
): FinalizedWeeklyScoringRecord | null {
  if (!isRecord(value)) {
    return null;
  }

  const season =
    sanitizePositiveInteger(
      value.season
    );

  const week =
    sanitizePositiveInteger(
      value.week
    );

  if (season <= 0 || week <= 0) {
    return null;
  }

  return {
    id: sanitizeString(
      value.id,
      fallbackId
    ),

    season,
    week,

    finalizedAt:
      sanitizeString(
        value.finalizedAt
      ),

    totalScheduledGames:
      sanitizeNumber(
        value.totalScheduledGames
      ),

    completedGameCount:
      sanitizeNumber(
        value.completedGameCount
      ),

    canceledGameCount:
      sanitizeNumber(
        value.canceledGameCount
      ),

    eligibleScoringGameCount:
      sanitizeNumber(
        value.eligibleScoringGameCount
      ),

    completedGameIds:
      sanitizeStringArray(
        value.completedGameIds
      ),

    canceledGameIds:
      sanitizeStringArray(
        value.canceledGameIds
      ),

    matchups:
      sanitizeFinalizedWeeklyMatchups(
        value.matchups
      ),

    playerResults:
      sanitizePlayerResults(
        value.playerResults
      ),
  };
}

function sanitizeWeeklyScoringHistory(
  value: unknown
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
        recordId
      );

    if (sanitizedRecord) {
      cleaned[sanitizedRecord.id] =
        sanitizedRecord;
    }

    return cleaned;
  }, {});
}

function sanitizePickerClickerFallbackStatus(
  value: unknown
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
  value: unknown
): PickerClickerAssignment | null {
  if (!isRecord(value)) {
    return null;
  }

  const season =
    sanitizePositiveInteger(
      value.season
    );

  const week =
    sanitizePositiveInteger(
      value.week
    );

  const cycleNumber =
    sanitizePositiveInteger(
      value.cycleNumber,
      1
    );

  if (
    season <= 0 ||
    week <= 0 ||
    typeof value.id !== "string" ||
    typeof value.sourcePlayerId !==
      "string" ||
    typeof value.sourcePlayerName !==
      "string" ||
    typeof value.sourceNFLTeam !==
      "string"
  ) {
    return null;
  }

  return {
    id: value.id,
    season,
    week,

    sourcePlayerId:
      value.sourcePlayerId,

    sourcePlayerName:
      value.sourcePlayerName,

    sourceNFLTeam:
      value.sourceNFLTeam,

    cycleNumber,

    assignedAt:
      sanitizeString(
        value.assignedAt
      ),
  };
}

function sanitizePickerClickerFallbackPick(
  value: unknown
): PickerClickerFallbackPick | null {
  if (!isRecord(value)) {
    return null;
  }

  const status =
    sanitizePickerClickerFallbackStatus(
      value.status
    );

  const season =
    sanitizePositiveInteger(
      value.season
    );

  const week =
    sanitizePositiveInteger(
      value.week
    );

  if (
    !status ||
    season <= 0 ||
    week <= 0 ||
    typeof value.id !== "string" ||
    typeof value.gameId !== "string" ||
    typeof value.playerId !== "string" ||
    typeof value.sourcePlayerId !==
      "string"
  ) {
    return null;
  }

  const team =
    sanitizeNullableString(value.team);

  if (
    status === "copied" &&
    !team
  ) {
    return null;
  }

  return {
    id: value.id,
    season,
    week,
    gameId: value.gameId,

    playerId: value.playerId,

    sourcePlayerId:
      value.sourcePlayerId,

    team:
      status === "copied"
        ? team
        : null,

    status,

    appliedAt:
      sanitizeString(
        value.appliedAt
      ),
  };
}

function sanitizePickerClickerWeekFallbacks(
  value: unknown
): PickerClickerWeekFallbacks {
  if (!isRecord(value)) {
    return {};
  }

  return Object.entries(value).reduce<
    PickerClickerWeekFallbacks
  >(
    (
      cleanedPlayers,
      [playerId, playerFallbacks]
    ) => {
      if (!isRecord(playerFallbacks)) {
        return cleanedPlayers;
      }

      const cleanPlayerFallbacks =
        Object.entries(
          playerFallbacks
        ).reduce<
          Record<
            string,
            PickerClickerFallbackPick
          >
        >(
          (
            cleanedGames,
            [gameId, fallbackValue]
          ) => {
            const sanitizedFallback =
              sanitizePickerClickerFallbackPick(
                fallbackValue
              );

            if (sanitizedFallback) {
              cleanedGames[gameId] =
                sanitizedFallback;
            }

            return cleanedGames;
          },
          {}
        );

      if (
        Object.keys(
          cleanPlayerFallbacks
        ).length > 0
      ) {
        cleanedPlayers[playerId] =
          cleanPlayerFallbacks;
      }

      return cleanedPlayers;
    },
    {}
  );
}

function sanitizePickerClickerWeekState(
  value: unknown,
  fallbackId: string
): PickerClickerWeekState | null {
  if (!isRecord(value)) {
    return null;
  }

  const assignment =
    sanitizePickerClickerAssignment(
      value.assignment
    );

  const season =
    sanitizePositiveInteger(
      value.season
    );

  const week =
    sanitizePositiveInteger(
      value.week
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
    id: sanitizeString(
      value.id,
      fallbackId
    ),

    season,
    week,

    assignment,

    fallbackPicks:
      sanitizePickerClickerWeekFallbacks(
        value.fallbackPicks
      ),

    ineligiblePlayerIds:
      sanitizeStringArray(
        value.ineligiblePlayerIds
      ),

    lockedGameIds:
      sanitizeStringArray(
        value.lockedGameIds
      ),

    updatedAt:
      sanitizeString(
        value.updatedAt,
        assignment.assignedAt
      ),
  };
}

function sanitizePickerClickerHistory(
  value: unknown
): PickerClickerHistory {
  if (!isRecord(value)) {
    return {};
  }

  return Object.entries(value).reduce<
    PickerClickerHistory
  >(
    (
      cleaned,
      [weekStateId, weekStateValue]
    ) => {
      const sanitizedWeekState =
        sanitizePickerClickerWeekState(
          weekStateValue,
          weekStateId
        );

      if (sanitizedWeekState) {
        cleaned[sanitizedWeekState.id] =
          sanitizedWeekState;
      }

      return cleaned;
    },
    {}
  );
}

function mergeLeagueState<TLeague>(
  fallbackLeague: TLeague,
  persistedLeague: unknown
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
  fallbackLeague: TLeague
): LeaguePersistenceState<TLeague> {
  const fallbackState: LeaguePersistenceState<TLeague> =
    {
      league: fallbackLeague,
      picks: {},
      activePlayerId: "",
      gameResults: {},
      scoringHistory: {},
      pickerClickerHistory: {},
    };

  if (!isBrowserStorageAvailable()) {
    return fallbackState;
  }

  try {
    const rawSnapshot =
      window.localStorage.getItem(
        STORAGE_KEY
      );

    if (!rawSnapshot) {
      return fallbackState;
    }

    const parsedSnapshot = JSON.parse(
      rawSnapshot
    ) as Partial<
      StoredLeagueSnapshot<TLeague>
    >;

    if (!isRecord(parsedSnapshot)) {
      return fallbackState;
    }

    return {
      league: mergeLeagueState(
        fallbackLeague,
        parsedSnapshot.league
      ),

      picks:
        sanitizePicks(
          parsedSnapshot.picks
        ),

      activePlayerId:
        typeof parsedSnapshot.activePlayerId ===
        "string"
          ? parsedSnapshot.activePlayerId
          : "",

      gameResults:
        sanitizeStringRecord(
          parsedSnapshot.gameResults
        ),

      scoringHistory:
        sanitizeWeeklyScoringHistory(
          parsedSnapshot.scoringHistory
        ),

      pickerClickerHistory:
        sanitizePickerClickerHistory(
          parsedSnapshot.pickerClickerHistory
        ),
    };
  } catch {
    return fallbackState;
  }
}

export function savePersistedLeagueState<
  TLeague,
>(
  state: LeaguePersistenceState<TLeague>
): boolean {
  if (!isBrowserStorageAvailable()) {
    return false;
  }

  try {
    const snapshot: StoredLeagueSnapshot<TLeague> =
      {
        schemaVersion:
          SCHEMA_VERSION,

        savedAt:
          new Date().toISOString(),

        league: state.league,
        picks: state.picks,

        activePlayerId:
          state.activePlayerId,

        gameResults:
          state.gameResults,

        scoringHistory:
          state.scoringHistory,

        pickerClickerHistory:
          state.pickerClickerHistory,
      };

    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(snapshot)
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
      STORAGE_KEY
    );

    return true;
  } catch {
    return false;
  }
}
import type {
  FinalizedWeeklyMatchupRecord,
  FinalizedWeeklyScoringRecord,
  WeeklyPlayerScoringResult,
  WeeklyScoringHistory,
  WeeklyScoringMatchupStatus,
  WeeklyScoringMatchupType,
  WeeklyScoringOutcome,
} from "./weeklyScoringTypes";

export type PersistedPicks = Record<string, Record<string, string>>;
export type PersistedGameResults = Record<string, string>;

export type LeaguePersistenceState<TLeague> = {
  league: TLeague;
  picks: PersistedPicks;
  activePlayerId: string;
  gameResults: PersistedGameResults;
  scoringHistory: WeeklyScoringHistory;
};

type StoredLeagueSnapshot<TLeague> = LeaguePersistenceState<TLeague> & {
  schemaVersion: number;
  savedAt: string;
};

const STORAGE_KEY = "head2head-brawlin-steel.league.v1";
const SCHEMA_VERSION = 2;

function isBrowserStorageAvailable() {
  return (
    typeof window !== "undefined" &&
    typeof window.localStorage !== "undefined"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function sanitizeString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function sanitizeNullableString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function sanitizeNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : fallback;
}

function sanitizeBoolean(value: unknown, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function sanitizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (item): item is string => typeof item === "string"
  );
}

function sanitizeStringRecord(
  value: unknown
): Record<string, string> {
  if (!isRecord(value)) {
    return {};
  }

  return Object.entries(value).reduce<Record<string, string>>(
    (cleaned, [key, recordValue]) => {
      if (typeof recordValue === "string") {
        cleaned[key] = recordValue;
      }

      return cleaned;
    },
    {}
  );
}

function sanitizePicks(value: unknown): PersistedPicks {
  if (!isRecord(value)) {
    return {};
  }

  return Object.entries(value).reduce<PersistedPicks>(
    (cleaned, [playerId, playerPicks]) => {
      const cleanPlayerPicks =
        sanitizeStringRecord(playerPicks);

      if (Object.keys(cleanPlayerPicks).length > 0) {
        cleaned[playerId] = cleanPlayerPicks;
      }

      return cleaned;
    },
    {}
  );
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

  const outcome = sanitizeWeeklyScoringOutcome(value.outcome);
  const matchupType =
    sanitizeWeeklyScoringMatchupType(value.matchupType);

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

  return {
    playerId: value.playerId,
    playerName: value.playerName,
    nflTeam: value.nflTeam,

    matchupId: value.matchupId,
    matchupType,

    opponentId: sanitizeNullableString(value.opponentId),
    opponentName: value.opponentName,

    correctPicks: sanitizeNumber(value.correctPicks),
    possiblePicks: sanitizeNumber(value.possiblePicks),
    missingPicks: sanitizeNumber(value.missingPicks),

    outcome,
    leaguePointsAwarded: sanitizeNumber(
      value.leaguePointsAwarded
    ),
  };
}

function sanitizePlayerResults(
  value: unknown
): Record<string, WeeklyPlayerScoringResult> {
  if (!isRecord(value)) {
    return {};
  }

  return Object.entries(value).reduce<
    Record<string, WeeklyPlayerScoringResult>
  >((cleaned, [playerId, playerResult]) => {
    const sanitizedResult =
      sanitizeWeeklyPlayerScoringResult(playerResult);

    if (sanitizedResult) {
      cleaned[playerId] = sanitizedResult;
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
    sanitizeWeeklyScoringMatchupType(value.matchupType);

  const status =
    sanitizeWeeklyScoringMatchupStatus(value.status);

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
    season: sanitizeNumber(value.season),
    week: sanitizeNumber(value.week),

    matchupId: value.matchupId,
    matchupType,
    ...(sourceGameId ? { sourceGameId } : {}),

    playerAId: value.playerAId,
    playerAName: value.playerAName,
    playerATeam: value.playerATeam,

    playerBId: sanitizeNullableString(value.playerBId),
    playerBName: sanitizeNullableString(value.playerBName),
    playerBTeam: sanitizeNullableString(value.playerBTeam),

    playerAScore: sanitizeNumber(value.playerAScore),
    playerBScore: sanitizeNumber(value.playerBScore),
    possiblePoints: sanitizeNumber(value.possiblePoints),

    winnerId: sanitizeNullableString(value.winnerId),
    isTie: sanitizeBoolean(value.isTie),

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

  return value.reduce<FinalizedWeeklyMatchupRecord[]>(
    (cleaned, matchup) => {
      const sanitizedMatchup =
        sanitizeFinalizedWeeklyMatchupRecord(matchup);

      if (sanitizedMatchup) {
        cleaned.push(sanitizedMatchup);
      }

      return cleaned;
    },
    []
  );
}

function sanitizeFinalizedWeeklyScoringRecord(
  value: unknown,
  fallbackId: string
): FinalizedWeeklyScoringRecord | null {
  if (!isRecord(value)) {
    return null;
  }

  const season = sanitizeNumber(value.season);
  const week = sanitizeNumber(value.week);

  if (season <= 0 || week <= 0) {
    return null;
  }

  return {
    id: sanitizeString(value.id, fallbackId),
    season,
    week,
    finalizedAt: sanitizeString(value.finalizedAt),

    totalScheduledGames: sanitizeNumber(
      value.totalScheduledGames
    ),
    completedGameCount: sanitizeNumber(
      value.completedGameCount
    ),
    canceledGameCount: sanitizeNumber(
      value.canceledGameCount
    ),
    eligibleScoringGameCount: sanitizeNumber(
      value.eligibleScoringGameCount
    ),

    completedGameIds: sanitizeStringArray(
      value.completedGameIds
    ),
    canceledGameIds: sanitizeStringArray(
      value.canceledGameIds
    ),

    matchups: sanitizeFinalizedWeeklyMatchups(
      value.matchups
    ),

    playerResults: sanitizePlayerResults(
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

  return Object.entries(value).reduce<WeeklyScoringHistory>(
    (cleaned, [recordId, recordValue]) => {
      const sanitizedRecord =
        sanitizeFinalizedWeeklyScoringRecord(
          recordValue,
          recordId
        );

      if (sanitizedRecord) {
        cleaned[sanitizedRecord.id] = sanitizedRecord;
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

export function loadPersistedLeagueState<TLeague>(
  fallbackLeague: TLeague
): LeaguePersistenceState<TLeague> {
  const fallbackState: LeaguePersistenceState<TLeague> = {
    league: fallbackLeague,
    picks: {},
    activePlayerId: "",
    gameResults: {},
    scoringHistory: {},
  };

  if (!isBrowserStorageAvailable()) {
    return fallbackState;
  }

  try {
    const rawSnapshot =
      window.localStorage.getItem(STORAGE_KEY);

    if (!rawSnapshot) {
      return fallbackState;
    }

    const parsedSnapshot = JSON.parse(
      rawSnapshot
    ) as Partial<StoredLeagueSnapshot<TLeague>>;

    if (!isRecord(parsedSnapshot)) {
      return fallbackState;
    }

    return {
      league: mergeLeagueState(
        fallbackLeague,
        parsedSnapshot.league
      ),

      picks: sanitizePicks(parsedSnapshot.picks),

      activePlayerId:
        typeof parsedSnapshot.activePlayerId === "string"
          ? parsedSnapshot.activePlayerId
          : "",

      gameResults: sanitizeStringRecord(
        parsedSnapshot.gameResults
      ),

      scoringHistory: sanitizeWeeklyScoringHistory(
        parsedSnapshot.scoringHistory
      ),
    };
  } catch {
    return fallbackState;
  }
}

export function savePersistedLeagueState<TLeague>(
  state: LeaguePersistenceState<TLeague>
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
    window.localStorage.removeItem(STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}
export type PersistedPicks = Record<string, Record<string, string>>;
export type PersistedGameResults = Record<string, string>;

export type LeaguePersistenceState<TLeague> = {
  league: TLeague;
  picks: PersistedPicks;
  activePlayerId: string;
  gameResults: PersistedGameResults;
};

type StoredLeagueSnapshot<TLeague> = LeaguePersistenceState<TLeague> & {
  schemaVersion: number;
  savedAt: string;
};

const STORAGE_KEY = "head2head-brawlin-steel.league.v1";
const SCHEMA_VERSION = 1;

function isBrowserStorageAvailable() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sanitizeStringRecord(value: unknown): Record<string, string> {
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
      const cleanPlayerPicks = sanitizeStringRecord(playerPicks);

      if (Object.keys(cleanPlayerPicks).length > 0) {
        cleaned[playerId] = cleanPlayerPicks;
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
  if (!isRecord(fallbackLeague) || !isRecord(persistedLeague)) {
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
  };

  if (!isBrowserStorageAvailable()) {
    return fallbackState;
  }

  try {
    const rawSnapshot = window.localStorage.getItem(STORAGE_KEY);

    if (!rawSnapshot) {
      return fallbackState;
    }

    const parsedSnapshot = JSON.parse(rawSnapshot) as Partial<
      StoredLeagueSnapshot<TLeague>
    >;

    if (!isRecord(parsedSnapshot)) {
      return fallbackState;
    }

    return {
      league: mergeLeagueState(fallbackLeague, parsedSnapshot.league),
      picks: sanitizePicks(parsedSnapshot.picks),
      activePlayerId:
        typeof parsedSnapshot.activePlayerId === "string"
          ? parsedSnapshot.activePlayerId
          : "",
      gameResults: sanitizeStringRecord(parsedSnapshot.gameResults),
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
    };

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
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
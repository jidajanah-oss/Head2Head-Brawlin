const LEAGUE_STORAGE_KEY = "head2head-brawlin-steel.league.v1";
const CLEANUP_MARKER_KEY =
  "head2head-brawlin-steel.placeholder-roster-cleanup.v2";

const JIMBO_PLAYER_ID =
  "9e78b7a8-0e8f-4217-b364-0e633f5ce25d";

type StoredPlayer = {
  id: string;
  name: string;
  nflTeam: string;
  role?: unknown;
  status?: unknown;
  [key: string]: unknown;
};

type RecordValue = Record<string, unknown>;

function isRecord(value: unknown): value is RecordValue {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function isStoredPlayer(value: unknown): value is StoredPlayer {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.nflTeam === "string"
  );
}

function normalizeName(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeTeam(value: string): string {
  return value.trim().toUpperCase();
}

function isConfirmedPlaceholderPlayer(
  player: StoredPlayer,
): boolean {
  const name = normalizeName(player.name);
  const team = normalizeTeam(player.nflTeam);

  return (
    (name === "player 1" && team === "PIT") ||
    (name === "player 2" && team === "DAL") ||
    (name === "player 3" && team === "PHI") ||
    (name === "player 4" && team === "BUF") ||
    ((name === "brandon" || name === "brabdon") &&
      team === "BAL") ||
    (name === "brenton" && team === "CIN") ||
    (name === "dot" && team === "CLE")
  );
}

function keepPicksForPlayers(
  picks: unknown,
  players: StoredPlayer[],
): RecordValue {
  if (!isRecord(picks)) {
    return {};
  }

  const validPlayerIds = new Set(
    players.map((player) => player.id),
  );

  return Object.entries(picks).reduce<RecordValue>(
    (cleanedPicks, [playerId, playerPicks]) => {
      if (
        validPlayerIds.has(playerId) &&
        isRecord(playerPicks)
      ) {
        cleanedPicks[playerId] = playerPicks;
      }

      return cleanedPicks;
    },
    {},
  );
}

/**
 * Removes only the seven confirmed temporary players. This migration is
 * versioned and runs once, so future real players with similar names are not
 * affected after the cleanup has completed.
 */
export function migrateLegacyPlaceholderRoster(): boolean {
  if (
    typeof window === "undefined" ||
    typeof window.localStorage === "undefined"
  ) {
    return false;
  }

  try {
    if (
      window.localStorage.getItem(CLEANUP_MARKER_KEY) ===
      "complete"
    ) {
      return false;
    }

    const rawSnapshot = window.localStorage.getItem(
      LEAGUE_STORAGE_KEY,
    );

    if (!rawSnapshot) {
      return false;
    }

    const parsedSnapshot: unknown = JSON.parse(rawSnapshot);
    if (!isRecord(parsedSnapshot)) {
      return false;
    }

    const storedLeague = parsedSnapshot.league;
    if (!isRecord(storedLeague)) {
      return false;
    }

    const storedPlayers = storedLeague.players;
    if (
      !Array.isArray(storedPlayers) ||
      !storedPlayers.every(isStoredPlayer)
    ) {
      return false;
    }

    const jimbo = storedPlayers.find(
      (player) => player.id === JIMBO_PLAYER_ID,
    );

    if (
      !jimbo ||
      normalizeName(jimbo.name) !== "jimbo" ||
      normalizeTeam(jimbo.nflTeam) !== "WAS"
    ) {
      return false;
    }

    const remainingPlayers = storedPlayers
      .filter(
        (player) => !isConfirmedPlaceholderPlayer(player),
      )
      .map((player) => {
        if (player.id !== JIMBO_PLAYER_ID) {
          return player;
        }

        return {
          ...player,
          name: "Jimbo",
          nflTeam: "WAS",
          status: "active",
          role: "commissioner",
        };
      });

    if (remainingPlayers.length === storedPlayers.length) {
      return false;
    }

    const migratedSnapshot: RecordValue = {
      ...parsedSnapshot,
      savedAt: new Date().toISOString(),
      league: {
        ...storedLeague,
        players: remainingPlayers,
      },
      picks: keepPicksForPlayers(
        parsedSnapshot.picks,
        remainingPlayers,
      ),
      activePlayerId: JIMBO_PLAYER_ID,
      scoringHistory: {},
      pickerClickerHistory: {},
      obscureStatCoinFlipHistory: {},
      payoutLedgerHistory: {},
      playoffResultsHistory: {},
    };

    window.localStorage.setItem(
      LEAGUE_STORAGE_KEY,
      JSON.stringify(migratedSnapshot),
    );
    window.localStorage.setItem(
      CLEANUP_MARKER_KEY,
      "complete",
    );

    return true;
  } catch {
    return false;
  }
}
import type {
  FutureSeasonPlan,
  FutureSeasonPlanStatus,
  FutureSeasonPlayerPlan,
  FutureSeasonRosterDecision,
} from "./futureSeasonTypes";
import type {
  PlayerRole,
  PlayerStatus,
} from "../types/player";

export const FUTURE_SEASON_STORAGE_KEY =
  "head2head-brawlin-steel.future-seasons.v1";

export type FutureSeasonPlanHistory = Record<
  string,
  FutureSeasonPlan
>;

export type FutureSeasonPersistenceState = {
  activePlanId: string | null;
  plans: FutureSeasonPlanHistory;
};

type StoredFutureSeasonSnapshot =
  FutureSeasonPersistenceState & {
    schemaVersion: number;
    savedAt: string;
  };

const FUTURE_SEASON_SCHEMA_VERSION = 1;

function isBrowserStorageAvailable(): boolean {
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

function sanitizeOptionalString(
  value: unknown,
): string | undefined {
  if (
    typeof value !== "string" ||
    !value.trim()
  ) {
    return undefined;
  }

  return value.trim();
}

function sanitizePositiveInteger(
  value: unknown,
): number {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value <= 0
  ) {
    return 0;
  }

  return value;
}

function sanitizeBoolean(
  value: unknown,
): boolean {
  return value === true;
}

function sanitizePlanStatus(
  value: unknown,
): FutureSeasonPlanStatus | null {
  if (
    value === "draft" ||
    value === "ready" ||
    value === "activated"
  ) {
    return value;
  }

  return null;
}

function sanitizeRosterDecision(
  value: unknown,
): FutureSeasonRosterDecision | null {
  if (
    value === "returning" ||
    value === "replacement" ||
    value === "inactive"
  ) {
    return value;
  }

  return null;
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

function sanitizeFutureSeasonPlayerPlan(
  value: unknown,
): FutureSeasonPlayerPlan | null {
  if (!isRecord(value)) {
    return null;
  }

  const playerId =
    sanitizeString(value.playerId).trim();

  const sourcePlayerId =
    sanitizeString(
      value.sourcePlayerId,
    ).trim();

  const role = sanitizePlayerRole(value.role);

  const status = sanitizePlayerStatus(
    value.status,
  );

  const rosterDecision =
    sanitizeRosterDecision(
      value.rosterDecision,
    );

  if (
    !playerId ||
    !sourcePlayerId ||
    !role ||
    !status ||
    !rosterDecision
  ) {
    return null;
  }

  const email = sanitizeOptionalString(
    value.email,
  );

  const customLogo =
    sanitizeOptionalString(
      value.customLogo,
    );

  return {
    playerId,
    sourcePlayerId,
    name: sanitizeString(value.name).trim(),
    nflTeam: sanitizeString(
      value.nflTeam,
    )
      .trim()
      .toUpperCase(),
    ...(email ? { email } : {}),
    ...(customLogo
      ? { customLogo }
      : {}),
    role,
    status,
    rosterDecision,
    preservesCloudLink: sanitizeBoolean(
      value.preservesCloudLink,
    ),
  };
}

function sanitizeFutureSeasonPlayers(
  value: unknown,
): FutureSeasonPlayerPlan[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const seenSourcePlayerIds =
    new Set<string>();

  return value.reduce<
    FutureSeasonPlayerPlan[]
  >((cleaned, playerValue) => {
    const player =
      sanitizeFutureSeasonPlayerPlan(
        playerValue,
      );

    if (
      !player ||
      seenSourcePlayerIds.has(
        player.sourcePlayerId,
      )
    ) {
      return cleaned;
    }

    seenSourcePlayerIds.add(
      player.sourcePlayerId,
    );

    cleaned.push(player);

    return cleaned;
  }, []);
}

function sanitizeFutureSeasonPlan(
  value: unknown,
  fallbackId: string,
): FutureSeasonPlan | null {
  if (!isRecord(value)) {
    return null;
  }

  const sourceSeason =
    sanitizePositiveInteger(
      value.sourceSeason,
    );

  const targetSeason =
    sanitizePositiveInteger(
      value.targetSeason,
    );

  const status = sanitizePlanStatus(
    value.status,
  );

  const id =
    sanitizeString(
      value.id,
      fallbackId,
    ).trim();

  const createdAt =
    sanitizeString(value.createdAt).trim();

  const updatedAt =
    sanitizeString(value.updatedAt).trim();

  if (
    !id ||
    sourceSeason <= 0 ||
    targetSeason <= 0 ||
    !status ||
    !createdAt ||
    !updatedAt
  ) {
    return null;
  }

  const activatedAt =
    sanitizeOptionalString(
      value.activatedAt,
    );

  return {
    id,
    sourceSeason,
    targetSeason,
    leagueName: sanitizeString(
      value.leagueName,
    ).trim(),
    status,
    players: sanitizeFutureSeasonPlayers(
      value.players,
    ),
    createdAt,
    updatedAt,
    ...(status === "activated" &&
    activatedAt
      ? { activatedAt }
      : {}),
  };
}

function sanitizeFutureSeasonPlanHistory(
  value: unknown,
): FutureSeasonPlanHistory {
  if (!isRecord(value)) {
    return {};
  }

  return Object.entries(value).reduce<
    FutureSeasonPlanHistory
  >((cleaned, [planId, planValue]) => {
    const plan = sanitizeFutureSeasonPlan(
      planValue,
      planId,
    );

    if (plan) {
      cleaned[plan.id] = plan;
    }

    return cleaned;
  }, {});
}

function getEmptyFutureSeasonState(): FutureSeasonPersistenceState {
  return {
    activePlanId: null,
    plans: {},
  };
}

export function loadPersistedFutureSeasonState(): FutureSeasonPersistenceState {
  const fallbackState =
    getEmptyFutureSeasonState();

  if (!isBrowserStorageAvailable()) {
    return fallbackState;
  }

  try {
    const rawSnapshot =
      window.localStorage.getItem(
        FUTURE_SEASON_STORAGE_KEY,
      );

    if (!rawSnapshot) {
      return fallbackState;
    }

    const parsedSnapshot: unknown =
      JSON.parse(rawSnapshot);

    if (!isRecord(parsedSnapshot)) {
      return fallbackState;
    }

    const plans =
      sanitizeFutureSeasonPlanHistory(
        parsedSnapshot.plans,
      );

    const requestedActivePlanId =
      sanitizeOptionalString(
        parsedSnapshot.activePlanId,
      ) ?? null;

    const activePlanId =
      requestedActivePlanId &&
      plans[requestedActivePlanId]
        ? requestedActivePlanId
        : Object.keys(plans)[0] ?? null;

    return {
      activePlanId,
      plans,
    };
  } catch {
    return fallbackState;
  }
}

export function savePersistedFutureSeasonState(
  state: FutureSeasonPersistenceState,
): boolean {
  if (!isBrowserStorageAvailable()) {
    return false;
  }

  try {
    const activePlanId =
      state.activePlanId &&
      state.plans[state.activePlanId]
        ? state.activePlanId
        : null;

    const snapshot: StoredFutureSeasonSnapshot =
      {
        schemaVersion:
          FUTURE_SEASON_SCHEMA_VERSION,
        savedAt: new Date().toISOString(),
        activePlanId,
        plans: state.plans,
      };

    window.localStorage.setItem(
      FUTURE_SEASON_STORAGE_KEY,
      JSON.stringify(snapshot),
    );

    return true;
  } catch {
    return false;
  }
}

export function clearPersistedFutureSeasonState(): boolean {
  if (!isBrowserStorageAvailable()) {
    return false;
  }

  try {
    window.localStorage.removeItem(
      FUTURE_SEASON_STORAGE_KEY,
    );

    return true;
  } catch {
    return false;
  }
}
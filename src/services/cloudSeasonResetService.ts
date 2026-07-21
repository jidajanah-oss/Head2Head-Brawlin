import type {
  SupabaseClient,
} from "@supabase/supabase-js";

const LEAGUE_STORAGE_KEY =
  "head2head-brawlin-steel.league.v1";

const SEASON_AWARD_STORAGE_KEY =
  "head2head-brawlin-steel.season-award-coin-flips.v1";

const RESET_MARKER_STORAGE_KEY =
  "head2head-brawlin-steel.season-reset-marker.v1";

export type CloudSeasonReset = {
  resetId: string;
  leagueId: string;
  season: number;
  resetAt: string;
};

export type CloudSeasonResetResult =
  CloudSeasonReset & {
    deletedPlayerPickCount: number;
    deletedSubmissionCount: number;
    deletedPickerClickerAssignmentCount: number;
    deletedScoringRecordCount: number;
    clearedGameResultCount: number;
  };

type UnknownRecord =
  Record<string, unknown>;

function isRecord(
  value: unknown,
): value is UnknownRecord {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function requiredString(
  value: UnknownRecord,
  key: string,
): string {
  const field = value[key];

  if (
    typeof field !== "string" ||
    !field.trim()
  ) {
    throw new Error(
      `The season reset response has an invalid ${key} value.`,
    );
  }

  return field;
}

function requiredNumber(
  value: UnknownRecord,
  key: string,
): number {
  const field = value[key];

  if (
    typeof field !== "number" ||
    !Number.isFinite(field)
  ) {
    throw new Error(
      `The season reset response has an invalid ${key} value.`,
    );
  }

  return field;
}

function normalizeLeagueId(
  value: string,
): string {
  const leagueId = value.trim();

  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      leagueId,
    )
  ) {
    throw new Error(
      "League ID must be a valid UUID.",
    );
  }

  return leagueId;
}

function normalizeSeason(
  value: number,
): number {
  if (
    !Number.isInteger(value) ||
    value < 2000 ||
    value > 2100
  ) {
    throw new Error(
      "Season must be an integer between 2000 and 2100.",
    );
  }

  return value;
}

function mapCloudSeasonReset(
  value: unknown,
): CloudSeasonReset {
  if (!isRecord(value)) {
    throw new Error(
      "The season reset service returned an invalid response.",
    );
  }

  return {
    resetId: requiredString(
      value,
      "reset_id",
    ),
    leagueId: normalizeLeagueId(
      requiredString(
        value,
        "league_id",
      ),
    ),
    season: normalizeSeason(
      requiredNumber(
        value,
        "season",
      ),
    ),
    resetAt: requiredString(
      value,
      "reset_at",
    ),
  };
}

function mapCloudSeasonResetResult(
  value: unknown,
): CloudSeasonResetResult {
  if (!isRecord(value)) {
    throw new Error(
      "The season reset service returned an invalid response.",
    );
  }

  return {
    ...mapCloudSeasonReset(value),
    deletedPlayerPickCount:
      requiredNumber(
        value,
        "deleted_player_pick_count",
      ),
    deletedSubmissionCount:
      requiredNumber(
        value,
        "deleted_submission_count",
      ),
    deletedPickerClickerAssignmentCount:
      requiredNumber(
        value,
        "deleted_picker_clicker_assignment_count",
      ),
    deletedScoringRecordCount:
      requiredNumber(
        value,
        "deleted_scoring_record_count",
      ),
    clearedGameResultCount:
      requiredNumber(
        value,
        "cleared_game_result_count",
      ),
  };
}

function getErrorMessage(
  action: string,
  message: string,
): Error {
  const normalized = message.trim();

  if (
    normalized.includes(
      "Only the primary commissioner",
    ) ||
    normalized.includes(
      "permission denied",
    ) ||
    normalized.includes(
      "row-level security",
    )
  ) {
    return new Error(
      `Unable to ${action}: only the primary commissioner can perform this reset.`,
    );
  }

  if (
    normalized.includes(
      "RESET 2026",
    )
  ) {
    return new Error(
      "Type RESET 2026 exactly to continue.",
    );
  }

  if (
    normalized.includes(
      "reset_current_season_test_data",
    ) ||
    normalized.includes(
      "season_reset_events",
    )
  ) {
    return new Error(
      `Unable to ${action}: deploy the protected season reset database migration first.`,
    );
  }

  return new Error(
    `Unable to ${action}: ${normalized || "unknown cloud error"}`,
  );
}

export async function
loadLatestCloudSeasonReset(
  client: SupabaseClient,
  leagueId: string,
  season: number,
): Promise<CloudSeasonReset | null> {
  const normalizedLeagueId =
    normalizeLeagueId(leagueId);
  const normalizedSeason =
    normalizeSeason(season);

  const { data, error } = await client
    .from("season_reset_events")
    .select(
      [
        "reset_id",
        "league_id",
        "season",
        "reset_at",
      ].join(","),
    )
    .eq(
      "league_id",
      normalizedLeagueId,
    )
    .eq(
      "season",
      normalizedSeason,
    )
    .order(
      "reset_at",
      {
        ascending: false,
      },
    )
    .limit(1);

  if (error) {
    throw getErrorMessage(
      "check season reset status",
      error.message,
    );
  }

  if (!Array.isArray(data)) {
    throw new Error(
      "The season reset service returned an invalid response.",
    );
  }

  return data.length === 0
    ? null
    : mapCloudSeasonReset(data[0]);
}

export async function
resetCurrentSeasonTestData(
  client: SupabaseClient,
  leagueId: string,
  confirmationText: string,
): Promise<CloudSeasonResetResult> {
  const normalizedLeagueId =
    normalizeLeagueId(leagueId);

  const { data, error } = await client
    .rpc(
      "reset_current_season_test_data",
      {
        target_league_id:
          normalizedLeagueId,
        confirmation_text:
          confirmationText,
      },
    )
    .single();

  if (error) {
    throw getErrorMessage(
      "reset the 2026 test data",
      error.message,
    );
  }

  return mapCloudSeasonResetResult(data);
}

function readAppliedResetId(): string {
  if (
    typeof window === "undefined" ||
    !window.localStorage
  ) {
    return "";
  }

  try {
    return (
      window.localStorage.getItem(
        RESET_MARKER_STORAGE_KEY,
      ) ?? ""
    );
  } catch {
    return "";
  }
}

function writeAppliedResetId(
  resetId: string,
): void {
  if (
    typeof window === "undefined" ||
    !window.localStorage
  ) {
    return;
  }

  try {
    window.localStorage.setItem(
      RESET_MARKER_STORAGE_KEY,
      resetId,
    );
  } catch {
    // The cloud reset remains authoritative
    // even when local storage is unavailable.
  }
}

function clearSeasonAwardResolutions(): void {
  if (
    typeof window === "undefined" ||
    !window.localStorage
  ) {
    return;
  }

  try {
    window.localStorage.removeItem(
      SEASON_AWARD_STORAGE_KEY,
    );
  } catch {
    // Keep the reset usable if storage is
    // restricted by the browser.
  }
}

function resetLocalLeagueSnapshot(
  reset: CloudSeasonReset,
): void {
  if (
    typeof window === "undefined" ||
    !window.localStorage
  ) {
    return;
  }

  try {
    const rawSnapshot =
      window.localStorage.getItem(
        LEAGUE_STORAGE_KEY,
      );

    if (!rawSnapshot) {
      return;
    }

    const parsedSnapshot: unknown =
      JSON.parse(rawSnapshot);

    if (!isRecord(parsedSnapshot)) {
      return;
    }

    const leagueValue =
      parsedSnapshot.league;

    if (!isRecord(leagueValue)) {
      return;
    }

    const settingsValue =
      leagueValue.settings;

    const localSeason =
      isRecord(settingsValue)
        ? Number(
            settingsValue.season,
          )
        : 0;

    if (
      Number.isInteger(localSeason) &&
      localSeason > 0 &&
      localSeason !== reset.season
    ) {
      return;
    }

    const nextSnapshot = {
      ...parsedSnapshot,
      savedAt:
        new Date().toISOString(),
      league: {
        ...leagueValue,
        currentWeek: 1,
      },
      picks: {},
      gameResults: {},
      scoringHistory: {},
      pickerClickerHistory: {},
      obscureStatCoinFlipHistory: {},
      playoffResultsHistory: {},
    };

    window.localStorage.setItem(
      LEAGUE_STORAGE_KEY,
      JSON.stringify(
        nextSnapshot,
      ),
    );
  } catch {
    // The page reload still allows cloud state
    // to replace any usable local state.
  }
}

export function
applyLocalSeasonResetIfNeeded(
  reset: CloudSeasonReset,
): boolean {
  if (
    readAppliedResetId() ===
    reset.resetId
  ) {
    return false;
  }

  resetLocalLeagueSnapshot(reset);
  clearSeasonAwardResolutions();
  writeAppliedResetId(
    reset.resetId,
  );

  return true;
}

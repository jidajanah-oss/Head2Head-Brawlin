import type {
  SupabaseClient,
} from "@supabase/supabase-js";

const WEEKLY_SUBMISSION_COLUMNS = [
  "league_id",
  "player_id",
  "week",
  "submitted_at",
  "reopened_at",
  "updated_by",
  "created_at",
  "updated_at",
].join(",");

export type CloudWeeklyPickSubmission = {
  leagueId: string;
  playerId: string;
  week: number;
  submittedAt: string;
  reopenedAt: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
  status:
    | "submitted"
    | "reopened";
};

export type CloudWeeklyPickSubmissionTarget = {
  leagueId: string;
  playerId: string;
  week: number;
};

export type CloudWeeklyPickIntentInput = {
  gameId: string;
  selectedTeam: string | null;
  source:
    | "player"
    | "picker_clicker";
  pickerClickerSourcePlayerId:
    string | null;
  submittedAt: string | null;
};

function normalizeRequiredIdentifier(
  value: string,
  label: string,
): string {
  const normalized =
    value.trim();

  if (!normalized) {
    throw new Error(
      `${label} is required.`,
    );
  }

  return normalized;
}

function normalizeWeek(
  value: number,
): number {
  if (
    !Number.isInteger(value) ||
    value < 1 ||
    value > 18
  ) {
    throw new Error(
      "Week must be an integer between 1 and 18.",
    );
  }

  return value;
}

function normalizeNullableText(
  value: string | null,
): string | null {
  if (value === null) {
    return null;
  }

  const normalized =
    value.trim();

  return normalized || null;
}

function normalizeSubmissionIntent(
  intent: CloudWeeklyPickIntentInput,
): {
  game_id: string;
  selected_team: string | null;
  source:
    | "player"
    | "picker_clicker";
  picker_clicker_source_player_id:
    string | null;
  submitted_at: string | null;
} {
  const gameId =
    normalizeRequiredIdentifier(
      intent.gameId,
      "Game ID",
    );
  const selectedTeam =
    normalizeNullableText(
      intent.selectedTeam,
    )?.toUpperCase() ?? null;
  const sourcePlayerId =
    normalizeNullableText(
      intent
        .pickerClickerSourcePlayerId,
    );
  const submittedAt =
    normalizeNullableText(
      intent.submittedAt,
    );

  if (
    submittedAt !== null &&
    Number.isNaN(
      Date.parse(submittedAt),
    )
  ) {
    throw new Error(
      "The pick timestamp is invalid.",
    );
  }

  if (
    intent.source ===
      "player" &&
    !selectedTeam
  ) {
    throw new Error(
      "A manual pick requires a selected team.",
    );
  }

  if (
    intent.source ===
      "picker_clicker" &&
    !sourcePlayerId
  ) {
    throw new Error(
      "A Picker Clicker choice requires the shared source player.",
    );
  }

  return {
    game_id: gameId,
    selected_team:
      intent.source ===
        "player"
        ? selectedTeam
        : null,
    source:
      intent.source,
    picker_clicker_source_player_id:
      intent.source ===
        "picker_clicker"
        ? sourcePlayerId
        : null,
    submitted_at:
      submittedAt,
  };
}

function isRecord(
  value: unknown,
): value is Record<
  string,
  unknown
> {
  return (
    typeof value ===
      "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function readRequiredString(
  value: Record<
    string,
    unknown
  >,
  key: string,
): string {
  const field = value[key];

  if (
    typeof field !==
      "string" ||
    !field.trim()
  ) {
    throw new Error(
      `The cloud submission row has an invalid ${key} value.`,
    );
  }

  return field;
}

function readNullableString(
  value: Record<
    string,
    unknown
  >,
  key: string,
): string | null {
  const field = value[key];

  if (
    field === null ||
    field === undefined
  ) {
    return null;
  }

  if (
    typeof field !==
      "string"
  ) {
    throw new Error(
      `The cloud submission row has an invalid ${key} value.`,
    );
  }

  return field;
}

function readWeek(
  value: Record<
    string,
    unknown
  >,
): number {
  const field = value.week;

  if (
    typeof field !==
      "number"
  ) {
    throw new Error(
      "The cloud submission row has an invalid week value.",
    );
  }

  return normalizeWeek(field);
}

function mapCloudWeeklyPickSubmission(
  value: unknown,
): CloudWeeklyPickSubmission {
  if (!isRecord(value)) {
    throw new Error(
      "The cloud submission service returned an invalid row.",
    );
  }

  const reopenedAt =
    readNullableString(
      value,
      "reopened_at",
    );

  return {
    leagueId:
      readRequiredString(
        value,
        "league_id",
      ),
    playerId:
      readRequiredString(
        value,
        "player_id",
      ),
    week:
      readWeek(value),
    submittedAt:
      readRequiredString(
        value,
        "submitted_at",
      ),
    reopenedAt,
    updatedBy:
      readNullableString(
        value,
        "updated_by",
      ),
    createdAt:
      readRequiredString(
        value,
        "created_at",
      ),
    updatedAt:
      readRequiredString(
        value,
        "updated_at",
      ),
    status:
      reopenedAt
        ? "reopened"
        : "submitted",
  };
}

function normalizeTarget(
  target: CloudWeeklyPickSubmissionTarget,
) {
  return {
    leagueId:
      normalizeRequiredIdentifier(
        target.leagueId,
        "League ID",
      ),
    playerId:
      normalizeRequiredIdentifier(
        target.playerId,
        "Player ID",
      ),
    week:
      normalizeWeek(
        target.week,
      ),
  };
}

function wrapCloudSubmissionError(
  action: string,
  message: string,
): Error {
  const normalizedMessage =
    message.trim();

  if (
    normalizedMessage.includes(
      "Open games are still missing cloud pick intent",
    )
  ) {
    return new Error(
      "One or more current choices could not be synchronized. Reopen Picks and confirm every still-open game has a manual pick or deliberate Picker Clicker choice.",
    );
  }

  if (
    normalizedMessage.includes(
      "cloud schedule is not ready",
    )
  ) {
    return new Error(
      "The cloud schedule is still synchronizing. Wait a moment, then try again.",
    );
  }

  if (
    normalizedMessage.includes(
      "Players may submit only their own",
    ) ||
    normalizedMessage.includes(
      "Only a commissioner can reopen",
    ) ||
    normalizedMessage.includes(
      "row-level security",
    ) ||
    normalizedMessage.includes(
      "permission denied",
    )
  ) {
    return new Error(
      `Unable to ${action}: the signed-in account does not have permission for this weekly entry.`,
    );
  }

  if (
    normalizedMessage.includes(
      "submit_weekly_picks_with_intents",
    )
  ) {
    return new Error(
      `Unable to ${action}: apply the atomic weekly pick-sync migration first.`,
    );
  }

  if (
    normalizedMessage.includes(
      "submit_weekly_picks",
    ) ||
    normalizedMessage.includes(
      "reopen_weekly_pick_submission",
    )
  ) {
    return new Error(
      `Unable to ${action}: apply the weekly submission database migration first.`,
    );
  }

  return new Error(
    `Unable to ${action}: ${normalizedMessage || "unknown cloud error"}`,
  );
}

export async function loadCloudWeeklyPickSubmission(
  client: SupabaseClient,
  target: CloudWeeklyPickSubmissionTarget,
): Promise<
  CloudWeeklyPickSubmission | null
> {
  const normalized =
    normalizeTarget(target);
  const {
    data,
    error,
  } = await client
    .from(
      "weekly_pick_submissions",
    )
    .select(
      WEEKLY_SUBMISSION_COLUMNS,
    )
    .eq(
      "league_id",
      normalized.leagueId,
    )
    .eq(
      "player_id",
      normalized.playerId,
    )
    .eq(
      "week",
      normalized.week,
    )
    .maybeSingle();

  if (error) {
    throw wrapCloudSubmissionError(
      "load the weekly submission",
      error.message,
    );
  }

  return data
    ? mapCloudWeeklyPickSubmission(
        data,
      )
    : null;
}

export async function submitCloudWeeklyPicks(
  client: SupabaseClient,
  target: CloudWeeklyPickSubmissionTarget,
  intents: CloudWeeklyPickIntentInput[],
): Promise<CloudWeeklyPickSubmission> {
  const normalized =
    normalizeTarget(target);
  const normalizedIntents =
    intents.map(
      normalizeSubmissionIntent,
    );
  const seenGameIds =
    new Set<string>();

  for (
    const intent of
    normalizedIntents
  ) {
    if (
      seenGameIds.has(
        intent.game_id,
      )
    ) {
      throw new Error(
        "The weekly submission contains a duplicate game choice.",
      );
    }

    seenGameIds.add(
      intent.game_id,
    );
  }

  const {
    data,
    error,
  } = await client
    .rpc(
      "submit_weekly_picks_with_intents",
      {
        target_league_id:
          normalized.leagueId,
        target_player_id:
          normalized.playerId,
        target_week:
          normalized.week,
        target_intents:
          normalizedIntents,
      },
    )
    .single();

  if (error) {
    throw wrapCloudSubmissionError(
      "synchronize and submit weekly picks",
      error.message,
    );
  }

  return mapCloudWeeklyPickSubmission(
    data,
  );
}

export async function reopenCloudWeeklyPickSubmission(
  client: SupabaseClient,
  target: CloudWeeklyPickSubmissionTarget,
): Promise<CloudWeeklyPickSubmission> {
  const normalized =
    normalizeTarget(target);
  const {
    data,
    error,
  } = await client
    .rpc(
      "reopen_weekly_pick_submission",
      {
        target_league_id:
          normalized.leagueId,
        target_player_id:
          normalized.playerId,
        target_week:
          normalized.week,
      },
    )
    .single();

  if (error) {
    throw wrapCloudSubmissionError(
      "reopen the weekly submission",
      error.message,
    );
  }

  return mapCloudWeeklyPickSubmission(
    data,
  );
}

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getWeeklyScoringRecordId,
  type FinalizedWeeklyScoringRecord,
} from "../engine/weeklyScoringTypes";

export type CloudWeeklyScoringRecord = {
  leagueId: string;
  season: number;
  week: number;
  record: FinalizedWeeklyScoringRecord;
  finalizedAt: string;
  publishedAt: string;
  publishedBy: string | null;
  createdAt: string;
};

export type CloudWeeklyScoringPickIntent = {
  playerId: string;
  gameId: string;
  week: number;
  selectedTeam: string | null;
  source: "player" | "picker_clicker" | "commissioner";
  pickerClickerSourcePlayerId: string | null;
  submittedAt: string | null;
  updatedAt: string;
};

type CloudWeeklyScoringRow = {
  league_id: string;
  season: number;
  week: number;
  record_payload: unknown;
  finalized_at: string;
  published_at: string;
  published_by: string | null;
  created_at: string;
};

type CloudWeeklyScoringPickRow = {
  player_id: string;
  game_id: string;
  week: number;
  selected_team: string | null;
  source: string;
  picker_clicker_source_player_id: string | null;
  submitted_at: string | null;
  updated_at: string;
};

type CloudServiceError = {
  code?: string;
  message: string;
};

const WEEKLY_SCORING_COLUMNS = [
  "league_id",
  "season",
  "week",
  "record_payload",
  "finalized_at",
  "published_at",
  "published_by",
  "created_at",
].join(",");

const SCORING_PICK_COLUMNS = [
  "player_id",
  "game_id",
  "week",
  "selected_team",
  "source",
  "picker_clicker_source_player_id",
  "submitted_at",
  "updated_at",
].join(",");

function normalizeRequiredText(
  value: string,
  label: string,
): string {
  const normalizedValue = value.trim();

  if (!normalizedValue) {
    throw new Error(`${label} is required.`);
  }

  return normalizedValue;
}

function normalizeLeagueId(value: string): string {
  const leagueId = normalizeRequiredText(
    value,
    "League ID",
  );

  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      leagueId,
    )
  ) {
    throw new Error("League ID must be a valid UUID.");
  }

  return leagueId;
}

function normalizeSeason(season: number): number {
  if (
    !Number.isInteger(season) ||
    season < 2000 ||
    season > 2100
  ) {
    throw new Error(
      "Season must be an integer between 2000 and 2100.",
    );
  }

  return season;
}

function normalizeWeek(week: number): number {
  if (
    !Number.isInteger(week) ||
    week < 1 ||
    week > 18
  ) {
    throw new Error(
      "Week must be an integer between 1 and 18.",
    );
  }

  return week;
}

function normalizeNFLTeam(
  value: string,
): string {
  const team = value.trim().toUpperCase();

  if (!/^[A-Z]{2,3}$/.test(team)) {
    throw new Error(
      "The cloud scoring pick contains an invalid NFL team abbreviation.",
    );
  }

  return team;
}

function normalizeTimestamp(
  value: string,
  label: string,
): string {
  const timestamp = value.trim();

  if (
    !timestamp ||
    Number.isNaN(Date.parse(timestamp))
  ) {
    throw new Error(`${label} must be a valid ISO date.`);
  }

  return timestamp;
}

function isNullableString(
  value: unknown,
): value is string | null {
  return value === null || typeof value === "string";
}

function isRecordObject(
  value: unknown,
): value is Record<string, unknown> {
  return Boolean(
    value &&
      typeof value === "object" &&
      !Array.isArray(value),
  );
}

function isStringArray(
  value: unknown,
): value is string[] {
  return (
    Array.isArray(value) &&
    value.every((item) => typeof item === "string")
  );
}

function isFinalizedWeeklyScoringRecord(
  value: unknown,
): value is FinalizedWeeklyScoringRecord {
  if (!isRecordObject(value)) {
    return false;
  }

  if (
    typeof value.id !== "string" ||
    typeof value.season !== "number" ||
    typeof value.week !== "number" ||
    typeof value.finalizedAt !== "string" ||
    Number.isNaN(Date.parse(value.finalizedAt)) ||
    typeof value.totalScheduledGames !== "number" ||
    typeof value.completedGameCount !== "number" ||
    typeof value.canceledGameCount !== "number" ||
    typeof value.eligibleScoringGameCount !== "number" ||
    !isStringArray(value.completedGameIds) ||
    !isStringArray(value.canceledGameIds) ||
    !Array.isArray(value.matchups) ||
    !isRecordObject(value.playerResults)
  ) {
    return false;
  }

  return (
    value.id ===
    getWeeklyScoringRecordId(
      value.season,
      value.week,
    )
  );
}

function readWeeklyScoringRow(
  value: unknown,
): CloudWeeklyScoringRow {
  if (!isRecordObject(value)) {
    throw new Error(
      "The cloud weekly scoring service returned an invalid row.",
    );
  }

  if (
    typeof value.league_id !== "string" ||
    typeof value.season !== "number" ||
    typeof value.week !== "number" ||
    typeof value.finalized_at !== "string" ||
    typeof value.published_at !== "string" ||
    !isNullableString(value.published_by) ||
    typeof value.created_at !== "string"
  ) {
    throw new Error(
      "The cloud weekly scoring service returned an invalid row.",
    );
  }

  return {
    league_id: value.league_id,
    season: value.season,
    week: value.week,
    record_payload: value.record_payload,
    finalized_at: value.finalized_at,
    published_at: value.published_at,
    published_by: value.published_by,
    created_at: value.created_at,
  };
}

function mapWeeklyScoringRecord(
  value: unknown,
): CloudWeeklyScoringRecord {
  const row = readWeeklyScoringRow(value);
  const leagueId = normalizeLeagueId(row.league_id);
  const season = normalizeSeason(row.season);
  const week = normalizeWeek(row.week);

  if (
    !isFinalizedWeeklyScoringRecord(
      row.record_payload,
    ) ||
    row.record_payload.season !== season ||
    row.record_payload.week !== week
  ) {
    throw new Error(
      "The cloud weekly scoring service returned an invalid scoring record.",
    );
  }

  return {
    leagueId,
    season,
    week,
    record: row.record_payload,
    finalizedAt: normalizeTimestamp(
      row.finalized_at,
      "Finalized timestamp",
    ),
    publishedAt: normalizeTimestamp(
      row.published_at,
      "Published timestamp",
    ),
    publishedBy: row.published_by,
    createdAt: normalizeTimestamp(
      row.created_at,
      "Created timestamp",
    ),
  };
}

function readScoringPickRow(
  value: unknown,
): CloudWeeklyScoringPickRow {
  if (!isRecordObject(value)) {
    throw new Error(
      "The cloud weekly scoring service returned an invalid pick row.",
    );
  }

  if (
    typeof value.player_id !== "string" ||
    typeof value.game_id !== "string" ||
    typeof value.week !== "number" ||
    !isNullableString(value.selected_team) ||
    typeof value.source !== "string" ||
    !isNullableString(
      value.picker_clicker_source_player_id,
    ) ||
    !isNullableString(value.submitted_at) ||
    typeof value.updated_at !== "string"
  ) {
    throw new Error(
      "The cloud weekly scoring service returned an invalid pick row.",
    );
  }

  return {
    player_id: value.player_id,
    game_id: value.game_id,
    week: value.week,
    selected_team: value.selected_team,
    source: value.source,
    picker_clicker_source_player_id:
      value.picker_clicker_source_player_id,
    submitted_at: value.submitted_at,
    updated_at: value.updated_at,
  };
}

function mapScoringPickIntent(
  value: unknown,
): CloudWeeklyScoringPickIntent {
  const row = readScoringPickRow(value);
  const playerId = normalizeRequiredText(
    row.player_id,
    "Player ID",
  );
  const gameId = normalizeRequiredText(
    row.game_id,
    "Game ID",
  );
  const week = normalizeWeek(row.week);

  if (
    row.source !== "player" &&
    row.source !== "picker_clicker" &&
    row.source !== "commissioner"
  ) {
    throw new Error(
      `The cloud scoring pick contains an unsupported source: ${row.source}.`,
    );
  }

  if (row.source === "picker_clicker") {
    const sourcePlayerId = normalizeRequiredText(
      row.picker_clicker_source_player_id ?? "",
      "Picker Clicker source player ID",
    );

    if (
      row.selected_team !== null ||
      sourcePlayerId === playerId
    ) {
      throw new Error(
        "The cloud scoring service returned an invalid Picker Clicker intent.",
      );
    }

    return {
      playerId,
      gameId,
      week,
      selectedTeam: null,
      source: row.source,
      pickerClickerSourcePlayerId: sourcePlayerId,
      submittedAt:
        row.submitted_at === null
          ? null
          : normalizeTimestamp(
              row.submitted_at,
              "Submitted timestamp",
            ),
      updatedAt: normalizeTimestamp(
        row.updated_at,
        "Updated timestamp",
      ),
    };
  }

  return {
    playerId,
    gameId,
    week,
    selectedTeam: normalizeNFLTeam(
      row.selected_team ?? "",
    ),
    source: row.source,
    pickerClickerSourcePlayerId: null,
    submittedAt:
      row.submitted_at === null
        ? null
        : normalizeTimestamp(
            row.submitted_at,
            "Submitted timestamp",
          ),
    updatedAt: normalizeTimestamp(
      row.updated_at,
      "Updated timestamp",
    ),
  };
}

function wrapCloudScoringError(
  action: string,
  error: CloudServiceError,
): Error {
  const message = error.message.trim();
  const normalizedMessage = message.toLowerCase();

  if (
    error.code === "42501" ||
    normalizedMessage.includes("row-level security") ||
    normalizedMessage.includes("permission denied")
  ) {
    return new Error(
      `Unable to ${action}: only a linked league member can read results and only a commissioner can publish them.`,
    );
  }

  if (
    normalizedMessage.includes(
      "cloud schedule is not complete",
    )
  ) {
    return new Error(
      `Unable to ${action}: the cloud NFL schedule is not complete yet.`,
    );
  }

  return new Error(
    `Unable to ${action}: ${
      message || "unknown cloud error"
    }`,
  );
}

export async function loadCloudWeeklyScoringRecords(
  client: SupabaseClient,
  leagueId: string,
  season: number,
): Promise<CloudWeeklyScoringRecord[]> {
  const normalizedLeagueId = normalizeLeagueId(leagueId);
  const normalizedSeason = normalizeSeason(season);

  const { data, error } = await client
    .from("weekly_scoring_records")
    .select(WEEKLY_SCORING_COLUMNS)
    .eq("league_id", normalizedLeagueId)
    .eq("season", normalizedSeason)
    .order("week", { ascending: true });

  if (error) {
    throw wrapCloudScoringError(
      "load weekly scoring records",
      error,
    );
  }

  if (!Array.isArray(data)) {
    throw new Error(
      "The cloud weekly scoring service returned an invalid response.",
    );
  }

  return data.map(mapWeeklyScoringRecord);
}

export async function loadCloudWeeklyScoringPickIntents(
  client: SupabaseClient,
  leagueId: string,
  week: number,
): Promise<CloudWeeklyScoringPickIntent[]> {
  const normalizedLeagueId = normalizeLeagueId(leagueId);
  const normalizedWeek = normalizeWeek(week);

  const { data, error } = await client
    .from("player_picks")
    .select(SCORING_PICK_COLUMNS)
    .eq("league_id", normalizedLeagueId)
    .eq("week", normalizedWeek)
    .order("player_id", { ascending: true })
    .order("game_id", { ascending: true });

  if (error) {
    throw wrapCloudScoringError(
      "load weekly scoring pick intents",
      error,
    );
  }

  if (!Array.isArray(data)) {
    throw new Error(
      "The cloud weekly scoring service returned an invalid pick response.",
    );
  }

  return data.map(mapScoringPickIntent);
}

export async function publishCloudWeeklyScoringRecord(
  client: SupabaseClient,
  leagueId: string,
  record: FinalizedWeeklyScoringRecord,
): Promise<CloudWeeklyScoringRecord> {
  const normalizedLeagueId = normalizeLeagueId(leagueId);
  const season = normalizeSeason(record.season);
  const week = normalizeWeek(record.week);

  if (!isFinalizedWeeklyScoringRecord(record)) {
    throw new Error(
      "A valid finalized weekly scoring record is required.",
    );
  }

  const { data, error } = await client
    .rpc("publish_weekly_scoring_record", {
      p_league_id: normalizedLeagueId,
      p_season: season,
      p_week: week,
      p_record_payload: record,
    })
    .single();

  if (error) {
    throw wrapCloudScoringError(
      "publish the weekly scoring record",
      error,
    );
  }

  return mapWeeklyScoringRecord(data);
}

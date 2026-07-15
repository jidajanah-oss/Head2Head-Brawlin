import type { SupabaseClient } from "@supabase/supabase-js";

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
  status: "submitted" | "reopened";
};

export type CloudWeeklyPickSubmissionTarget = {
  leagueId: string;
  playerId: string;
  week: number;
};

function normalizeRequiredIdentifier(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${label} is required.`);
  }
  return normalized;
}

function normalizeWeek(value: number): number {
  if (!Number.isInteger(value) || value < 1 || value > 18) {
    throw new Error("Week must be an integer between 1 and 18.");
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readRequiredString(
  value: Record<string, unknown>,
  key: string,
): string {
  const field = value[key];
  if (typeof field !== "string" || !field.trim()) {
    throw new Error(`The cloud submission row has an invalid ${key} value.`);
  }
  return field;
}

function readNullableString(
  value: Record<string, unknown>,
  key: string,
): string | null {
  const field = value[key];
  if (field === null || field === undefined) {
    return null;
  }
  if (typeof field !== "string") {
    throw new Error(`The cloud submission row has an invalid ${key} value.`);
  }
  return field;
}

function readWeek(value: Record<string, unknown>): number {
  const field = value.week;
  if (typeof field !== "number") {
    throw new Error("The cloud submission row has an invalid week value.");
  }
  return normalizeWeek(field);
}

function mapCloudWeeklyPickSubmission(
  value: unknown,
): CloudWeeklyPickSubmission {
  if (!isRecord(value)) {
    throw new Error("The cloud submission service returned an invalid row.");
  }

  const reopenedAt = readNullableString(value, "reopened_at");

  return {
    leagueId: readRequiredString(value, "league_id"),
    playerId: readRequiredString(value, "player_id"),
    week: readWeek(value),
    submittedAt: readRequiredString(value, "submitted_at"),
    reopenedAt,
    updatedBy: readNullableString(value, "updated_by"),
    createdAt: readRequiredString(value, "created_at"),
    updatedAt: readRequiredString(value, "updated_at"),
    status: reopenedAt ? "reopened" : "submitted",
  };
}

function normalizeTarget(target: CloudWeeklyPickSubmissionTarget) {
  return {
    leagueId: normalizeRequiredIdentifier(target.leagueId, "League ID"),
    playerId: normalizeRequiredIdentifier(target.playerId, "Player ID"),
    week: normalizeWeek(target.week),
  };
}

function wrapCloudSubmissionError(action: string, message: string): Error {
  const normalizedMessage = message.trim();

  if (normalizedMessage.includes("Open games are still missing cloud pick intent")) {
    return new Error(
      "Every still-open game needs a manual pick or deliberate Picker Clicker choice. Wait for cloud pick sync to finish, then try again.",
    );
  }

  if (normalizedMessage.includes("cloud schedule is not ready")) {
    return new Error(
      "The cloud schedule is still synchronizing. Wait a moment, then try again.",
    );
  }

  if (
    normalizedMessage.includes("Players may submit only their own") ||
    normalizedMessage.includes("Only a commissioner can reopen") ||
    normalizedMessage.includes("row-level security") ||
    normalizedMessage.includes("permission denied")
  ) {
    return new Error(
      `Unable to ${action}: the signed-in account does not have permission for this weekly entry.`,
    );
  }

  if (
    normalizedMessage.includes("submit_weekly_picks") ||
    normalizedMessage.includes("reopen_weekly_pick_submission")
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
): Promise<CloudWeeklyPickSubmission | null> {
  const normalized = normalizeTarget(target);
  const { data, error } = await client
    .from("weekly_pick_submissions")
    .select(WEEKLY_SUBMISSION_COLUMNS)
    .eq("league_id", normalized.leagueId)
    .eq("player_id", normalized.playerId)
    .eq("week", normalized.week)
    .maybeSingle();

  if (error) {
    throw wrapCloudSubmissionError(
      "load the weekly submission",
      error.message,
    );
  }

  return data ? mapCloudWeeklyPickSubmission(data) : null;
}

export async function submitCloudWeeklyPicks(
  client: SupabaseClient,
  target: CloudWeeklyPickSubmissionTarget,
): Promise<CloudWeeklyPickSubmission> {
  const normalized = normalizeTarget(target);
  const { data, error } = await client
    .rpc("submit_weekly_picks", {
      target_league_id: normalized.leagueId,
      target_player_id: normalized.playerId,
      target_week: normalized.week,
    })
    .single();

  if (error) {
    throw wrapCloudSubmissionError("submit weekly picks", error.message);
  }

  return mapCloudWeeklyPickSubmission(data);
}

export async function reopenCloudWeeklyPickSubmission(
  client: SupabaseClient,
  target: CloudWeeklyPickSubmissionTarget,
): Promise<CloudWeeklyPickSubmission> {
  const normalized = normalizeTarget(target);
  const { data, error } = await client
    .rpc("reopen_weekly_pick_submission", {
      target_league_id: normalized.leagueId,
      target_player_id: normalized.playerId,
      target_week: normalized.week,
    })
    .single();

  if (error) {
    throw wrapCloudSubmissionError(
      "reopen the weekly submission",
      error.message,
    );
  }

  return mapCloudWeeklyPickSubmission(data);
}

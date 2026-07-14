import type { SupabaseClient } from "@supabase/supabase-js";

export type CloudOpponentMatchupType =
  | "owned-opponent"
  | "open-opponent"
  | "bye";

export type CloudOpponentSubmissionStatus =
  | "submitted"
  | "reopened"
  | "not-submitted"
  | "not-applicable";

export type CloudOpponentPickIntentType =
  | "manual"
  | "picker-clicker-selected"
  | "picker-clicker-auto"
  | "missing";

export type CloudOpponentRevealedPick = {
  gameId: string;
  awayTeam: string;
  homeTeam: string;
  kickoffAt: string;
  gameStatus: "scheduled" | "live" | "final" | "canceled";
  locked: boolean;
  intentType: CloudOpponentPickIntentType;
  pickSource: "player" | "picker_clicker" | "commissioner" | null;
  selectedTeam: string | null;
  effectiveTeam: string | null;
  sourcePlayerId: string | null;
  sourcePlayerName: string | null;
};

export type CloudOpponentPickReveal = {
  leagueId: string;
  season: number;
  week: number;
  viewerPlayerId: string;
  viewerPlayerName: string;
  viewerNflTeam: string;
  opponentPlayerId: string | null;
  opponentPlayerName: string | null;
  opponentNflTeam: string | null;
  matchupType: CloudOpponentMatchupType;
  viewerSubmissionStatus: CloudOpponentSubmissionStatus;
  opponentSubmissionStatus: CloudOpponentSubmissionStatus;
  canReveal: boolean;
  revealedPicks: CloudOpponentRevealedPick[];
  checkedAt: string;
};

export type CloudOpponentPickRevealTarget = {
  leagueId: string;
  playerId: string;
  week: number;
};

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredString(value: UnknownRecord, key: string): string {
  const field = value[key];
  if (typeof field !== "string" || !field.trim()) {
    throw new Error(`The opponent reveal response has an invalid ${key} value.`);
  }
  return field;
}

function nullableString(value: UnknownRecord, key: string): string | null {
  const field = value[key];
  if (field === null || field === undefined) {
    return null;
  }
  if (typeof field !== "string") {
    throw new Error(`The opponent reveal response has an invalid ${key} value.`);
  }
  return field;
}

function requiredNumber(value: UnknownRecord, key: string): number {
  const field = value[key];
  if (typeof field !== "number" || !Number.isFinite(field)) {
    throw new Error(`The opponent reveal response has an invalid ${key} value.`);
  }
  return field;
}

function requiredBoolean(value: UnknownRecord, key: string): boolean {
  const field = value[key];
  if (typeof field !== "boolean") {
    throw new Error(`The opponent reveal response has an invalid ${key} value.`);
  }
  return field;
}

function normalizeIdentifier(value: string, label: string): string {
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

function isMatchupType(value: string): value is CloudOpponentMatchupType {
  return (
    value === "owned-opponent" ||
    value === "open-opponent" ||
    value === "bye"
  );
}

function isSubmissionStatus(
  value: string,
): value is CloudOpponentSubmissionStatus {
  return (
    value === "submitted" ||
    value === "reopened" ||
    value === "not-submitted" ||
    value === "not-applicable"
  );
}

function isIntentType(value: string): value is CloudOpponentPickIntentType {
  return (
    value === "manual" ||
    value === "picker-clicker-selected" ||
    value === "picker-clicker-auto" ||
    value === "missing"
  );
}

function isGameStatus(
  value: string,
): value is CloudOpponentRevealedPick["gameStatus"] {
  return (
    value === "scheduled" ||
    value === "live" ||
    value === "final" ||
    value === "canceled"
  );
}

function isPickSource(
  value: string | null,
): value is CloudOpponentRevealedPick["pickSource"] {
  return (
    value === null ||
    value === "player" ||
    value === "picker_clicker" ||
    value === "commissioner"
  );
}

function mapRevealedPick(value: unknown): CloudOpponentRevealedPick {
  if (!isRecord(value)) {
    throw new Error("The opponent reveal contains an invalid game row.");
  }

  const gameStatus = requiredString(value, "gameStatus");
  const intentType = requiredString(value, "intentType");
  const pickSource = nullableString(value, "pickSource");

  if (!isGameStatus(gameStatus)) {
    throw new Error(`Unsupported cloud game status: ${gameStatus}.`);
  }
  if (!isIntentType(intentType)) {
    throw new Error(`Unsupported opponent pick intent: ${intentType}.`);
  }
  if (!isPickSource(pickSource)) {
    throw new Error(`Unsupported opponent pick source: ${pickSource}.`);
  }

  return {
    gameId: requiredString(value, "gameId"),
    awayTeam: requiredString(value, "awayTeam"),
    homeTeam: requiredString(value, "homeTeam"),
    kickoffAt: requiredString(value, "kickoffAt"),
    gameStatus,
    locked: requiredBoolean(value, "locked"),
    intentType,
    pickSource,
    selectedTeam: nullableString(value, "selectedTeam"),
    effectiveTeam: nullableString(value, "effectiveTeam"),
    sourcePlayerId: nullableString(value, "sourcePlayerId"),
    sourcePlayerName: nullableString(value, "sourcePlayerName"),
  };
}

function mapReveal(value: unknown): CloudOpponentPickReveal {
  if (!isRecord(value)) {
    throw new Error("The opponent reveal service returned an invalid response.");
  }

  const matchupType = requiredString(value, "matchup_type");
  const viewerSubmissionStatus = requiredString(
    value,
    "viewer_submission_status",
  );
  const opponentSubmissionStatus = requiredString(
    value,
    "opponent_submission_status",
  );
  const revealedPicks = value.revealed_picks;

  if (!isMatchupType(matchupType)) {
    throw new Error(`Unsupported opponent matchup type: ${matchupType}.`);
  }
  if (!isSubmissionStatus(viewerSubmissionStatus)) {
    throw new Error(
      `Unsupported viewer submission status: ${viewerSubmissionStatus}.`,
    );
  }
  if (!isSubmissionStatus(opponentSubmissionStatus)) {
    throw new Error(
      `Unsupported opponent submission status: ${opponentSubmissionStatus}.`,
    );
  }
  if (!Array.isArray(revealedPicks)) {
    throw new Error("The opponent reveal response has invalid pick details.");
  }

  return {
    leagueId: requiredString(value, "league_id"),
    season: requiredNumber(value, "season"),
    week: normalizeWeek(requiredNumber(value, "week")),
    viewerPlayerId: requiredString(value, "viewer_player_id"),
    viewerPlayerName: requiredString(value, "viewer_player_name"),
    viewerNflTeam: requiredString(value, "viewer_nfl_team"),
    opponentPlayerId: nullableString(value, "opponent_player_id"),
    opponentPlayerName: nullableString(value, "opponent_player_name"),
    opponentNflTeam: nullableString(value, "opponent_nfl_team"),
    matchupType,
    viewerSubmissionStatus,
    opponentSubmissionStatus,
    canReveal: requiredBoolean(value, "can_reveal"),
    revealedPicks: revealedPicks.map(mapRevealedPick),
    checkedAt: requiredString(value, "checked_at"),
  };
}

function wrapRevealError(message: string): Error {
  const normalized = message.trim();

  if (
    normalized.includes("cannot view this head-to-head entry") ||
    normalized.includes("row-level security") ||
    normalized.includes("permission denied")
  ) {
    return new Error(
      "This signed-in account cannot view the selected head-to-head entry.",
    );
  }

  if (normalized.includes("get_opponent_pick_reveal")) {
    return new Error(
      "Apply the Cloud Opponent Pick Reveal database migration first.",
    );
  }

  return new Error(
    `Unable to load opponent picks: ${normalized || "unknown cloud error"}`,
  );
}

export async function loadCloudOpponentPickReveal(
  client: SupabaseClient,
  target: CloudOpponentPickRevealTarget,
): Promise<CloudOpponentPickReveal> {
  const leagueId = normalizeIdentifier(target.leagueId, "League ID");
  const playerId = normalizeIdentifier(target.playerId, "Player ID");
  const week = normalizeWeek(target.week);

  const { data, error } = await client
    .rpc("get_opponent_pick_reveal", {
      target_league_id: leagueId,
      target_player_id: playerId,
      target_week: week,
    })
    .single();

  if (error) {
    throw wrapRevealError(error.message);
  }

  return mapReveal(data);
}

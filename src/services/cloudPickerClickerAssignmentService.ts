import type { SupabaseClient } from "@supabase/supabase-js";

export type CloudPickerClickerWeekAssignment = {
  leagueId: string;
  season: number;
  week: number;
  sourcePlayerId: string;
  sourcePlayerName: string;
  sourceNFLTeam: string;
  cycleNumber: number;
  assignedAt: string;
  createdAt: string;
};

export type CreateCloudPickerClickerWeekAssignmentInput = {
  leagueId: string;
  season: number;
  week: number;
  sourcePlayerId: string;
  cycleNumber: number;
  assignedAt?: string;
};

export type CreateCloudPickerClickerWeekAssignmentResult = {
  assignment: CloudPickerClickerWeekAssignment;
  created: boolean;
};

type CloudPickerClickerWeekAssignmentRow = {
  league_id: string;
  season: number;
  week: number;
  source_player_id: string;
  source_player_name: string;
  source_nfl_team: string;
  cycle_number: number;
  assigned_at: string;
  created_at: string;
};

type CloudServiceError = {
  code?: string;
  message: string;
};

const ASSIGNMENT_COLUMNS = [
  "league_id",
  "season",
  "week",
  "source_player_id",
  "source_player_name",
  "source_nfl_team",
  "cycle_number",
  "assigned_at",
  "created_at",
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
  const leagueId = normalizeRequiredText(value, "League ID");

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
  if (!Number.isInteger(week) || week < 1 || week > 18) {
    throw new Error("Week must be an integer between 1 and 18.");
  }

  return week;
}

function normalizeCycleNumber(cycleNumber: number): number {
  if (!Number.isInteger(cycleNumber) || cycleNumber < 1) {
    throw new Error(
      "Picker Clicker cycle number must be a positive integer.",
    );
  }

  return cycleNumber;
}

function normalizeNFLTeam(value: string): string {
  const team = value.trim().toUpperCase();

  if (!/^[A-Z]{2,3}$/.test(team)) {
    throw new Error(
      "The cloud assignment contains an invalid NFL team abbreviation.",
    );
  }

  return team;
}

function normalizeTimestamp(
  value: string,
  label: string,
): string {
  const timestamp = value.trim();

  if (!timestamp || Number.isNaN(Date.parse(timestamp))) {
    throw new Error(`${label} must be a valid ISO date.`);
  }

  return timestamp;
}

function normalizeAssignedAt(value?: string): string {
  return value === undefined
    ? new Date().toISOString()
    : normalizeTimestamp(value, "Assigned timestamp");
}

function readAssignmentRow(
  value: unknown,
): CloudPickerClickerWeekAssignmentRow {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    throw new Error(
      "The cloud Picker Clicker service returned an invalid assignment row.",
    );
  }

  const row = value as Record<string, unknown>;

  if (
    typeof row.league_id !== "string" ||
    typeof row.season !== "number" ||
    typeof row.week !== "number" ||
    typeof row.source_player_id !== "string" ||
    typeof row.source_player_name !== "string" ||
    typeof row.source_nfl_team !== "string" ||
    typeof row.cycle_number !== "number" ||
    typeof row.assigned_at !== "string" ||
    typeof row.created_at !== "string"
  ) {
    throw new Error(
      "The cloud Picker Clicker service returned an invalid assignment row.",
    );
  }

  return {
    league_id: row.league_id,
    season: row.season,
    week: row.week,
    source_player_id: row.source_player_id,
    source_player_name: row.source_player_name,
    source_nfl_team: row.source_nfl_team,
    cycle_number: row.cycle_number,
    assigned_at: row.assigned_at,
    created_at: row.created_at,
  };
}

function mapAssignment(
  value: unknown,
): CloudPickerClickerWeekAssignment {
  const row = readAssignmentRow(value);

  return {
    leagueId: normalizeLeagueId(row.league_id),
    season: normalizeSeason(row.season),
    week: normalizeWeek(row.week),
    sourcePlayerId: normalizeRequiredText(
      row.source_player_id,
      "Source player ID",
    ),
    sourcePlayerName: normalizeRequiredText(
      row.source_player_name,
      "Source player name",
    ),
    sourceNFLTeam: normalizeNFLTeam(row.source_nfl_team),
    cycleNumber: normalizeCycleNumber(row.cycle_number),
    assignedAt: normalizeTimestamp(
      row.assigned_at,
      "Assigned timestamp",
    ),
    createdAt: normalizeTimestamp(
      row.created_at,
      "Created timestamp",
    ),
  };
}

function wrapAssignmentError(
  action: string,
  error: CloudServiceError,
): Error {
  const message = error.message.trim();
  const normalizedMessage = message.toLowerCase();

  if (
    normalizedMessage.includes(
      "create_picker_clicker_week_assignment",
    )
  ) {
    return new Error(
      `Unable to ${action}: deploy the Picker Clicker authorization recovery migration first.`,
    );
  }

  if (
    error.code === "42501" ||
    normalizedMessage.includes("row-level security") ||
    normalizedMessage.includes("permission denied")
  ) {
    return new Error(
      `Unable to ${action}: only a commissioner can create the weekly Picker Clicker assignment.`,
    );
  }

  if (
    error.code === "23505" &&
    normalizedMessage.includes(
      "picker_clicker_week_assignments_cycle_source_key",
    )
  ) {
    return new Error(
      `Unable to ${action}: that source player is already assigned in this Picker Clicker cycle.`,
    );
  }

  if (
    normalizedMessage.includes(
      "source must be an active league player",
    )
  ) {
    return new Error(
      `Unable to ${action}: the source must be an active league player.`,
    );
  }

  return new Error(
    `Unable to ${action}: ${message || "unknown cloud error"}`,
  );
}

export async function loadCloudPickerClickerWeekAssignments(
  client: SupabaseClient,
  leagueId: string,
  season?: number,
): Promise<CloudPickerClickerWeekAssignment[]> {
  const normalizedLeagueId = normalizeLeagueId(leagueId);

  let query = client
    .from("picker_clicker_week_assignments")
    .select(ASSIGNMENT_COLUMNS)
    .eq("league_id", normalizedLeagueId);

  if (season !== undefined) {
    query = query.eq("season", normalizeSeason(season));
  }

  const { data, error } = await query
    .order("season", { ascending: true })
    .order("week", { ascending: true });

  if (error) {
    throw wrapAssignmentError(
      "load Picker Clicker assignments",
      error,
    );
  }

  if (!Array.isArray(data)) {
    throw new Error(
      "The cloud Picker Clicker service returned an invalid response.",
    );
  }

  return data.map(mapAssignment);
}

export async function loadCloudPickerClickerWeekAssignment(
  client: SupabaseClient,
  leagueId: string,
  season: number,
  week: number,
): Promise<CloudPickerClickerWeekAssignment | null> {
  const normalizedLeagueId = normalizeLeagueId(leagueId);
  const normalizedSeason = normalizeSeason(season);
  const normalizedWeek = normalizeWeek(week);

  const { data, error } = await client
    .from("picker_clicker_week_assignments")
    .select(ASSIGNMENT_COLUMNS)
    .eq("league_id", normalizedLeagueId)
    .eq("season", normalizedSeason)
    .eq("week", normalizedWeek)
    .limit(1);

  if (error) {
    throw wrapAssignmentError(
      "load the Picker Clicker assignment",
      error,
    );
  }

  if (!Array.isArray(data)) {
    throw new Error(
      "The cloud Picker Clicker service returned an invalid response.",
    );
  }

  return data.length === 0 ? null : mapAssignment(data[0]);
}

export async function createCloudPickerClickerWeekAssignment(
  client: SupabaseClient,
  input: CreateCloudPickerClickerWeekAssignmentInput,
): Promise<CreateCloudPickerClickerWeekAssignmentResult> {
  const leagueId = normalizeLeagueId(input.leagueId);
  const season = normalizeSeason(input.season);
  const week = normalizeWeek(input.week);
  const sourcePlayerId = normalizeRequiredText(
    input.sourcePlayerId,
    "Source player ID",
  );
  const cycleNumber = normalizeCycleNumber(input.cycleNumber);
  const assignedAt = normalizeAssignedAt(input.assignedAt);

  const { data, error } = await client
    .rpc(
      "create_picker_clicker_week_assignment",
      {
        target_league_id: leagueId,
        target_season: season,
        target_week: week,
        target_source_player_id: sourcePlayerId,
        target_cycle_number: cycleNumber,
        target_assigned_at: assignedAt,
      },
    )
    .single();

  if (error) {
    throw wrapAssignmentError(
      "create the Picker Clicker assignment",
      error,
    );
  }

  if (
    !data ||
    typeof data !== "object" ||
    Array.isArray(data)
  ) {
    throw new Error(
      "The cloud Picker Clicker service returned an invalid assignment response.",
    );
  }

  const row = data as Record<string, unknown>;

  if (typeof row.created !== "boolean") {
    throw new Error(
      "The cloud Picker Clicker service returned an invalid creation result.",
    );
  }

  return {
    assignment: mapAssignment(data),
    created: row.created,
  };
}

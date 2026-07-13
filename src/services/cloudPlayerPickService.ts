import type { SupabaseClient } from "@supabase/supabase-js";

export type CloudPlayerPickChoice =
  | "manual"
  | "picker-clicker";

export type CloudPlayerPickSource =
  | "player"
  | "picker_clicker"
  | "commissioner";

export type CloudPlayerPickIntent = {
  leagueId: string;
  playerId: string;
  gameId: string;
  week: number;
  choice: CloudPlayerPickChoice;
  selectedTeam: string | null;
  pickerClickerSourcePlayerId: string | null;
  source: CloudPlayerPickSource;
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SaveCloudManualPickInput = {
  leagueId: string;
  playerId: string;
  gameId: string;
  selectedTeam: string;
  submittedAt?: string | null;
};

export type SaveCloudPickerClickerPickInput = {
  leagueId: string;
  playerId: string;
  gameId: string;
  sourcePlayerId: string;
  submittedAt?: string | null;
};

export type ClearCloudPlayerPickInput = {
  leagueId: string;
  playerId: string;
  gameId: string;
};

type CloudPlayerPickRow = {
  league_id: string;
  player_id: string;
  game_id: string;
  week: number;
  selected_team: string | null;
  source: string;
  picker_clicker_source_player_id: string | null;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
};

const PLAYER_PICK_COLUMNS = [
  "league_id",
  "player_id",
  "game_id",
  "week",
  "selected_team",
  "source",
  "picker_clicker_source_player_id",
  "submitted_at",
  "created_at",
  "updated_at",
].join(",");

function normalizeRequiredIdentifier(
  value: string,
  label: string,
): string {
  const normalizedValue = value.trim();

  if (!normalizedValue) {
    throw new Error(`${label} is required.`);
  }

  return normalizedValue;
}

function normalizeWeek(week: number): number {
  if (!Number.isInteger(week) || week < 1 || week > 18) {
    throw new Error("Week must be an integer between 1 and 18.");
  }

  return week;
}

function normalizeNFLTeam(team: string): string {
  const normalizedTeam = team.trim().toUpperCase();

  if (!/^[A-Z]{2,3}$/.test(normalizedTeam)) {
    throw new Error("A valid NFL team abbreviation is required.");
  }

  return normalizedTeam;
}

function normalizeOptionalTimestamp(
  value: string | null | undefined,
): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  const normalizedValue = value.trim();

  if (!normalizedValue || Number.isNaN(Date.parse(normalizedValue))) {
    throw new Error("The submitted timestamp must be a valid ISO date.");
  }

  return normalizedValue;
}

function isNullableString(
  value: unknown,
): value is string | null {
  return value === null || typeof value === "string";
}

function isCloudPlayerPickSource(
  value: string,
): value is CloudPlayerPickSource {
  return (
    value === "player" ||
    value === "picker_clicker" ||
    value === "commissioner"
  );
}

function getCloudPlayerPickRow(
  value: unknown,
): CloudPlayerPickRow | null {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return null;
  }

  const row = value as Record<string, unknown>;

  if (
    typeof row.league_id !== "string" ||
    typeof row.player_id !== "string" ||
    typeof row.game_id !== "string" ||
    typeof row.week !== "number" ||
    !isNullableString(row.selected_team) ||
    typeof row.source !== "string" ||
    !isNullableString(
      row.picker_clicker_source_player_id,
    ) ||
    !isNullableString(row.submitted_at) ||
    typeof row.created_at !== "string" ||
    typeof row.updated_at !== "string"
  ) {
    return null;
  }

  return {
    league_id: row.league_id,
    player_id: row.player_id,
    game_id: row.game_id,
    week: row.week,
    selected_team: row.selected_team,
    source: row.source,
    picker_clicker_source_player_id:
      row.picker_clicker_source_player_id,
    submitted_at: row.submitted_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function mapCloudPlayerPickRow(
  row: CloudPlayerPickRow,
): CloudPlayerPickIntent {
  const leagueId = normalizeRequiredIdentifier(
    row.league_id,
    "League ID",
  );
  const playerId = normalizeRequiredIdentifier(
    row.player_id,
    "Player ID",
  );
  const gameId = normalizeRequiredIdentifier(
    row.game_id,
    "Game ID",
  );
  const week = normalizeWeek(row.week);

  if (!isCloudPlayerPickSource(row.source)) {
    throw new Error(
      `The cloud pick contains an unsupported source: ${row.source}.`,
    );
  }

  if (row.source === "picker_clicker") {
    const sourcePlayerId = normalizeRequiredIdentifier(
      row.picker_clicker_source_player_id ?? "",
      "Picker Clicker source player ID",
    );

    if (sourcePlayerId === playerId) {
      throw new Error(
        "A player cannot use themselves as the Picker Clicker source.",
      );
    }

    if (row.selected_team !== null) {
      throw new Error(
        "A Picker Clicker intent cannot contain a frozen team selection.",
      );
    }

    return {
      leagueId,
      playerId,
      gameId,
      week,
      choice: "picker-clicker",
      selectedTeam: null,
      pickerClickerSourcePlayerId: sourcePlayerId,
      source: row.source,
      submittedAt: row.submitted_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  const selectedTeam = normalizeNFLTeam(
    row.selected_team ?? "",
  );

  if (row.picker_clicker_source_player_id !== null) {
    throw new Error(
      "A manual cloud pick cannot contain a Picker Clicker source player.",
    );
  }

  return {
    leagueId,
    playerId,
    gameId,
    week,
    choice: "manual",
    selectedTeam,
    pickerClickerSourcePlayerId: null,
    source: row.source,
    submittedAt: row.submitted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapSingleCloudPlayerPick(
  value: unknown,
): CloudPlayerPickIntent {
  const row = getCloudPlayerPickRow(value);

  if (!row) {
    throw new Error(
      "The cloud pick service returned an invalid pick row.",
    );
  }

  return mapCloudPlayerPickRow(row);
}

function wrapCloudPickError(
  action: string,
  message: string,
): Error {
  const normalizedMessage = message.trim();

  if (
    normalizedMessage.includes("row-level security") ||
    normalizedMessage.includes("Pick changes are locked")
  ) {
    return new Error(
      `Unable to ${action}: this game is locked or the signed-in account does not own the pick.`,
    );
  }

  return new Error(
    `Unable to ${action}: ${normalizedMessage || "unknown cloud error"}`,
  );
}

async function upsertCloudPlayerPick(
  client: SupabaseClient,
  payload: Record<string, unknown>,
): Promise<CloudPlayerPickIntent> {
  const { data, error } = await client
    .from("player_picks")
    .upsert(payload, {
      onConflict: "league_id,player_id,game_id",
    })
    .select(PLAYER_PICK_COLUMNS)
    .single();

  if (error) {
    throw wrapCloudPickError(
      "save the cloud pick",
      error.message,
    );
  }

  return mapSingleCloudPlayerPick(data);
}

export async function loadCloudPlayerPickIntents(
  client: SupabaseClient,
  leagueId: string,
  playerId: string,
  week?: number,
): Promise<CloudPlayerPickIntent[]> {
  const normalizedLeagueId = normalizeRequiredIdentifier(
    leagueId,
    "League ID",
  );
  const normalizedPlayerId = normalizeRequiredIdentifier(
    playerId,
    "Player ID",
  );

  let query = client
    .from("player_picks")
    .select(PLAYER_PICK_COLUMNS)
    .eq("league_id", normalizedLeagueId)
    .eq("player_id", normalizedPlayerId);

  if (week !== undefined) {
    query = query.eq("week", normalizeWeek(week));
  }

  const { data, error } = await query
    .order("week", { ascending: true })
    .order("game_id", { ascending: true });

  if (error) {
    throw wrapCloudPickError(
      "load cloud picks",
      error.message,
    );
  }

  if (!Array.isArray(data)) {
    throw new Error(
      "The cloud pick service returned an invalid response.",
    );
  }

  return data.map(mapSingleCloudPlayerPick);
}

export async function saveCloudManualPickIntent(
  client: SupabaseClient,
  input: SaveCloudManualPickInput,
): Promise<CloudPlayerPickIntent> {
  const leagueId = normalizeRequiredIdentifier(
    input.leagueId,
    "League ID",
  );
  const playerId = normalizeRequiredIdentifier(
    input.playerId,
    "Player ID",
  );
  const gameId = normalizeRequiredIdentifier(
    input.gameId,
    "Game ID",
  );
  const selectedTeam = normalizeNFLTeam(
    input.selectedTeam,
  );

  return upsertCloudPlayerPick(client, {
    league_id: leagueId,
    player_id: playerId,
    game_id: gameId,
    selected_team: selectedTeam,
    source: "player",
    picker_clicker_source_player_id: null,
    submitted_at: normalizeOptionalTimestamp(
      input.submittedAt,
    ),
  });
}

export async function saveCloudPickerClickerIntent(
  client: SupabaseClient,
  input: SaveCloudPickerClickerPickInput,
): Promise<CloudPlayerPickIntent> {
  const leagueId = normalizeRequiredIdentifier(
    input.leagueId,
    "League ID",
  );
  const playerId = normalizeRequiredIdentifier(
    input.playerId,
    "Player ID",
  );
  const gameId = normalizeRequiredIdentifier(
    input.gameId,
    "Game ID",
  );
  const sourcePlayerId = normalizeRequiredIdentifier(
    input.sourcePlayerId,
    "Picker Clicker source player ID",
  );

  if (sourcePlayerId === playerId) {
    throw new Error(
      "A player cannot use themselves as the Picker Clicker source.",
    );
  }

  return upsertCloudPlayerPick(client, {
    league_id: leagueId,
    player_id: playerId,
    game_id: gameId,
    selected_team: null,
    source: "picker_clicker",
    picker_clicker_source_player_id: sourcePlayerId,
    submitted_at: normalizeOptionalTimestamp(
      input.submittedAt,
    ),
  });
}

export async function clearCloudPlayerPickIntent(
  client: SupabaseClient,
  input: ClearCloudPlayerPickInput,
): Promise<boolean> {
  const leagueId = normalizeRequiredIdentifier(
    input.leagueId,
    "League ID",
  );
  const playerId = normalizeRequiredIdentifier(
    input.playerId,
    "Player ID",
  );
  const gameId = normalizeRequiredIdentifier(
    input.gameId,
    "Game ID",
  );

  const { data, error } = await client
    .from("player_picks")
    .delete()
    .eq("league_id", leagueId)
    .eq("player_id", playerId)
    .eq("game_id", gameId)
    .select("game_id");

  if (error) {
    throw wrapCloudPickError(
      "clear the cloud pick",
      error.message,
    );
  }

  return Array.isArray(data) && data.length > 0;
}

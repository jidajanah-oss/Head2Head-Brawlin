import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  CloudAccountLink,
} from "../engine/authAccessTypes";
import type { PlayerRole } from "../types/player";

type CurrentAccountLinkRow = {
  user_id: string;
  league_id: string;
  player_id: string;
  role: string;
  active: boolean;
  league_name: string | null;
  season: number | null;
  player_name: string | null;
  nfl_team: string | null;
};

type CloudConnectionStatusRow = {
  schema_version: number;
  service: string;
  checked_at: string;
};

const EXPECTED_SERVICE_NAME = "head2head-brawlin";
const MINIMUM_SCHEMA_VERSION = 4;

function isPlayerRole(value: string): value is PlayerRole {
  return (
    value === "commissioner" ||
    value === "backup_commissioner" ||
    value === "player"
  );
}

function isNullableString(
  value: unknown,
): value is string | null {
  return value === null || typeof value === "string";
}

function isNullableNumber(
  value: unknown,
): value is number | null {
  return value === null || typeof value === "number";
}

function getFirstConnectionRow(
  data: unknown,
): CloudConnectionStatusRow | null {
  if (!Array.isArray(data) || data.length === 0) {
    return null;
  }

  const row = data[0];
  if (!row || typeof row !== "object") {
    return null;
  }

  const candidate = row as Record<string, unknown>;
  if (
    typeof candidate.schema_version !== "number" ||
    typeof candidate.service !== "string" ||
    typeof candidate.checked_at !== "string"
  ) {
    return null;
  }

  return {
    schema_version: candidate.schema_version,
    service: candidate.service,
    checked_at: candidate.checked_at,
  };
}

function getCurrentAccountLinkRow(
  data: unknown,
): CurrentAccountLinkRow | null {
  if (
    !data ||
    typeof data !== "object" ||
    Array.isArray(data)
  ) {
    return null;
  }

  const candidate = data as Record<string, unknown>;

  if (
    typeof candidate.user_id !== "string" ||
    typeof candidate.league_id !== "string" ||
    typeof candidate.player_id !== "string" ||
    typeof candidate.role !== "string" ||
    typeof candidate.active !== "boolean" ||
    !isNullableString(candidate.league_name) ||
    !isNullableNumber(candidate.season) ||
    !isNullableString(candidate.player_name) ||
    !isNullableString(candidate.nfl_team)
  ) {
    return null;
  }

  return {
    user_id: candidate.user_id,
    league_id: candidate.league_id,
    player_id: candidate.player_id,
    role: candidate.role,
    active: candidate.active,
    league_name: candidate.league_name,
    season: candidate.season,
    player_name: candidate.player_name,
    nfl_team: candidate.nfl_team,
  };
}

export async function verifyCloudConnection(
  client: SupabaseClient,
): Promise<void> {
  const { data, error } = await client.rpc(
    "cloud_connection_status",
  );

  if (error) {
    throw new Error(
      `Cloud connection check failed: ${error.message}`,
    );
  }

  const row = getFirstConnectionRow(data);
  if (!row) {
    throw new Error(
      "Cloud connection check returned an invalid response.",
    );
  }

  if (row.service !== EXPECTED_SERVICE_NAME) {
    throw new Error(
      "The connected Supabase project is not the Head2Head Brawlin project.",
    );
  }

  if (row.schema_version < MINIMUM_SCHEMA_VERSION) {
    throw new Error(
      "The connected Supabase project is missing the Package 6 player onboarding migration.",
    );
  }
}

function mapCurrentAccountLink(
  row: CurrentAccountLinkRow,
): CloudAccountLink {
  if (!isPlayerRole(row.role)) {
    throw new Error(
      `Unsupported cloud account role: ${row.role}`,
    );
  }

  return {
    userId: row.user_id,
    leagueId: row.league_id,
    playerId: row.player_id,
    role: row.role,
    active: row.active,
    leagueName: row.league_name ?? undefined,
    season: row.season ?? undefined,
    playerName: row.player_name ?? undefined,
    nflTeam: row.nfl_team ?? undefined,
  };
}

async function claimPendingInvitation(
  client: SupabaseClient,
): Promise<void> {
  const { error } = await client.rpc(
    "claim_my_pending_invitation",
  );

  if (error) {
    throw new Error(
      `Unable to claim the pending player invitation: ${error.message}`,
    );
  }
}

export async function loadCurrentAccountLink(
  client: SupabaseClient,
): Promise<CloudAccountLink | null> {
  await claimPendingInvitation(client);

  const { data, error } = await client
    .from("current_account_link")
    .select(
      [
        "user_id",
        "league_id",
        "player_id",
        "role",
        "active",
        "league_name",
        "season",
        "player_name",
        "nfl_team",
      ].join(","),
    )
    .maybeSingle();

  if (error) {
    throw new Error(
      `Unable to load the signed-in account link: ${error.message}`,
    );
  }

  if (!data) {
    return null;
  }

  const row = getCurrentAccountLinkRow(data);
  if (!row) {
    throw new Error(
      "The signed-in account link returned an invalid response.",
    );
  }

  return mapCurrentAccountLink(row);
}

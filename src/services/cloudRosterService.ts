import type { SupabaseClient } from "@supabase/supabase-js";

import type { Player, PlayerRole, PlayerStatus } from "../types/player";

export type PlayerAccountStatus =
  | "linked"
  | "invitation_pending"
  | "not_linked";

export type PlayerAccountReadiness = {
  playerId: string;
  displayName: string;
  nflTeam: string;
  role: PlayerRole;
  playerStatus: PlayerStatus;
  accountStatus: PlayerAccountStatus;
  email?: string;
  invitationId?: string;
  invitationCreatedAt?: string;
  invitationExpiresAt?: string;
  lastSentAt?: string;
  linkedAt?: string;
};

type PlayerAccountReadinessRow = {
  player_id: string;
  display_name: string;
  nfl_team: string;
  role: string;
  player_status: string;
  account_status: string;
  email: string | null;
  invitation_id: string | null;
  invitation_created_at: string | null;
  invitation_expires_at: string | null;
  last_sent_at: string | null;
  linked_at: string | null;
};

type InvitationFunctionResponse = {
  ok: boolean;
  status: "sent" | "existing-user";
  message: string;
};

function isPlayerRole(value: unknown): value is PlayerRole {
  return (
    value === "commissioner" ||
    value === "backup_commissioner" ||
    value === "player"
  );
}

function isPlayerStatus(value: unknown): value is PlayerStatus {
  return value === "active" || value === "inactive";
}

function isAccountStatus(
  value: unknown,
): value is PlayerAccountStatus {
  return (
    value === "linked" ||
    value === "invitation_pending" ||
    value === "not_linked"
  );
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function getReadinessRow(
  value: unknown,
): PlayerAccountReadinessRow | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const row = value as Record<string, unknown>;

  if (
    typeof row.player_id !== "string" ||
    typeof row.display_name !== "string" ||
    typeof row.nfl_team !== "string" ||
    typeof row.role !== "string" ||
    typeof row.player_status !== "string" ||
    typeof row.account_status !== "string" ||
    !isNullableString(row.email) ||
    !isNullableString(row.invitation_id) ||
    !isNullableString(row.invitation_created_at) ||
    !isNullableString(row.invitation_expires_at) ||
    !isNullableString(row.last_sent_at) ||
    !isNullableString(row.linked_at)
  ) {
    return null;
  }

  return {
    player_id: row.player_id,
    display_name: row.display_name,
    nfl_team: row.nfl_team,
    role: row.role,
    player_status: row.player_status,
    account_status: row.account_status,
    email: row.email,
    invitation_id: row.invitation_id,
    invitation_created_at: row.invitation_created_at,
    invitation_expires_at: row.invitation_expires_at,
    last_sent_at: row.last_sent_at,
    linked_at: row.linked_at,
  };
}

function mapReadinessRow(
  row: PlayerAccountReadinessRow,
): PlayerAccountReadiness {
  if (!isPlayerRole(row.role)) {
    throw new Error(`Unsupported cloud player role: ${row.role}`);
  }

  if (!isPlayerStatus(row.player_status)) {
    throw new Error(
      `Unsupported cloud player status: ${row.player_status}`,
    );
  }

  if (!isAccountStatus(row.account_status)) {
    throw new Error(
      `Unsupported cloud account status: ${row.account_status}`,
    );
  }

  return {
    playerId: row.player_id,
    displayName: row.display_name,
    nflTeam: row.nfl_team,
    role: row.role,
    playerStatus: row.player_status,
    accountStatus: row.account_status,
    email: row.email ?? undefined,
    invitationId: row.invitation_id ?? undefined,
    invitationCreatedAt: row.invitation_created_at ?? undefined,
    invitationExpiresAt: row.invitation_expires_at ?? undefined,
    lastSentAt: row.last_sent_at ?? undefined,
    linkedAt: row.linked_at ?? undefined,
  };
}

async function getFunctionErrorMessage(
  error: unknown,
  fallback: string,
): Promise<string> {
  if (
    error &&
    typeof error === "object" &&
    "context" in error &&
    error.context instanceof Response
  ) {
    try {
      const body = await error.context.clone().json() as unknown;
      if (
        body &&
        typeof body === "object" &&
        "message" in body &&
        typeof body.message === "string"
      ) {
        return body.message;
      }
    } catch {
      // Fall through to the standard error message.
    }
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }

  return fallback;
}

export async function syncCloudRoster(
  client: SupabaseClient,
  leagueId: string,
  players: Player[],
): Promise<number> {
  const cloudPlayers = players.map((player) => ({
    id: player.id,
    name: player.name,
    nflTeam: player.nflTeam,
    role: player.role,
    status: player.status,
    customLogo: player.customLogo ?? null,
  }));

  const { data, error } = await client.rpc(
    "sync_current_league_roster",
    {
      p_league_id: leagueId,
      p_players: cloudPlayers,
    },
  );

  if (error) {
    throw new Error(`Unable to sync the cloud roster: ${error.message}`);
  }

  if (typeof data !== "number") {
    throw new Error("Cloud roster sync returned an invalid response.");
  }

  return data;
}

export async function loadPlayerAccountReadiness(
  client: SupabaseClient,
  leagueId: string,
): Promise<PlayerAccountReadiness[]> {
  const { data, error } = await client.rpc(
    "get_player_account_readiness",
    {
      p_league_id: leagueId,
    },
  );

  if (error) {
    throw new Error(
      `Unable to load player account status: ${error.message}`,
    );
  }

  if (!Array.isArray(data)) {
    throw new Error("Player account status returned an invalid response.");
  }

  return data.map((value) => {
    const row = getReadinessRow(value);
    if (!row) {
      throw new Error(
        "Player account status returned an invalid row.",
      );
    }

    return mapReadinessRow(row);
  });
}

export async function preparePlayerAccountInvitation(
  client: SupabaseClient,
  leagueId: string,
  playerId: string,
  email: string,
): Promise<string> {
  const { data, error } = await client.rpc(
    "prepare_player_account_invitation",
    {
      p_league_id: leagueId,
      p_player_id: playerId,
      p_email: email,
    },
  );

  if (error) {
    throw new Error(`Unable to prepare invitation: ${error.message}`);
  }

  if (typeof data !== "string") {
    throw new Error("Invitation preparation returned an invalid response.");
  }

  return data;
}

export async function revokePlayerAccountInvitation(
  client: SupabaseClient,
  invitationId: string,
): Promise<void> {
  const { data, error } = await client.rpc(
    "revoke_player_account_invitation",
    {
      p_invitation_id: invitationId,
    },
  );

  if (error) {
    throw new Error(`Unable to revoke invitation: ${error.message}`);
  }

  if (data !== true) {
    throw new Error("The pending invitation could not be revoked.");
  }
}

export async function sendPlayerAccountInvitation(
  client: SupabaseClient,
  invitationId: string,
): Promise<InvitationFunctionResponse> {
  const { data, error } = await client.functions.invoke(
    "invite-player",
    {
      body: { invitationId },
    },
  );

  if (error) {
    throw new Error(
      await getFunctionErrorMessage(
        error,
        "Unable to send the player invitation.",
      ),
    );
  }

  if (
    !data ||
    typeof data !== "object" ||
    data.ok !== true ||
    (data.status !== "sent" &&
      data.status !== "existing-user") ||
    typeof data.message !== "string"
  ) {
    throw new Error("Invitation service returned an invalid response.");
  }

  return {
    ok: true,
    status: data.status,
    message: data.message,
  };
}

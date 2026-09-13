import type {
  SupabaseClient,
} from "@supabase/supabase-js";
import type {
  Player,
  PlayerRole,
  PlayerStatus,
} from "../types/player";

type CloudLeaguePlayerRow = {
  player_id: string;
  display_name: string;
  nfl_team: string;
  role: string;
  status: string;
  custom_logo: string | null;
};

function isPlayerRole(
  value: unknown,
): value is PlayerRole {
  return (
    value === "commissioner" ||
    value === "backup_commissioner" ||
    value === "player"
  );
}

function isPlayerStatus(
  value: unknown,
): value is PlayerStatus {
  return (
    value === "active" ||
    value === "inactive"
  );
}

function getCloudLeaguePlayerRow(
  value: unknown,
): CloudLeaguePlayerRow | null {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return null;
  }

  const row =
    value as Record<string, unknown>;

  if (
    typeof row.player_id !== "string" ||
    typeof row.display_name !== "string" ||
    typeof row.nfl_team !== "string" ||
    typeof row.role !== "string" ||
    typeof row.status !== "string" ||
    !(
      row.custom_logo === null ||
      typeof row.custom_logo === "string"
    )
  ) {
    return null;
  }

  return {
    player_id: row.player_id,
    display_name: row.display_name,
    nfl_team: row.nfl_team,
    role: row.role,
    status: row.status,
    custom_logo: row.custom_logo,
  };
}

function mapCloudLeaguePlayer(
  row: CloudLeaguePlayerRow,
): Player {
  const playerId =
    row.player_id.trim();
  const playerName =
    row.display_name.trim();
  const nflTeam =
    row.nfl_team.trim().toUpperCase();

  if (!playerId) {
    throw new Error(
      "The cloud roster contains an invalid player ID.",
    );
  }

  if (!playerName) {
    throw new Error(
      "The cloud roster contains an invalid player name.",
    );
  }

  if (!/^[A-Z]{2,3}$/.test(nflTeam)) {
    throw new Error(
      `The cloud roster contains an invalid NFL team: ${nflTeam}.`,
    );
  }

  if (!isPlayerRole(row.role)) {
    throw new Error(
      `The cloud roster contains an unsupported role: ${row.role}.`,
    );
  }

  if (!isPlayerStatus(row.status)) {
    throw new Error(
      `The cloud roster contains an unsupported status: ${row.status}.`,
    );
  }

  const customLogo =
    row.custom_logo?.trim();

  return {
    id: playerId,
    name: playerName,
    nflTeam,
    role: row.role,
    status: row.status,
    customLogo:
      customLogo || undefined,
  };
}

function validateCloudRoster(
  players: Player[],
): void {
  if (
    players.length < 1 ||
    players.length > 32
  ) {
    throw new Error(
      "The active cloud roster must contain between 1 and 32 players.",
    );
  }

  const playerIds =
    new Set<string>();
  const nflTeams =
    new Set<string>();

  for (const player of players) {
    if (playerIds.has(player.id)) {
      throw new Error(
        `The active cloud roster contains duplicate player ID ${player.id}.`,
      );
    }

    if (nflTeams.has(player.nflTeam)) {
      throw new Error(
        `The active cloud roster contains duplicate NFL team ${player.nflTeam}.`,
      );
    }

    playerIds.add(player.id);
    nflTeams.add(player.nflTeam);
  }
}

export async function loadCloudLeagueRoster(
  client: SupabaseClient,
  leagueId: string,
): Promise<Player[]> {
  const normalizedLeagueId =
    leagueId.trim();

  if (!normalizedLeagueId) {
    throw new Error(
      "A league ID is required to load the cloud roster.",
    );
  }

  const { data, error } = await client
    .from("league_players")
    .select(
      [
        "player_id",
        "display_name",
        "nfl_team",
        "role",
        "status",
        "custom_logo",
      ].join(","),
    )
    .eq(
      "league_id",
      normalizedLeagueId,
    )
    .eq("status", "active")
    .order("role", {
      ascending: true,
    })
    .order("display_name", {
      ascending: true,
    });

  if (error) {
    throw new Error(
      `Unable to load the active cloud roster: ${error.message}`,
    );
  }

  if (!Array.isArray(data)) {
    throw new Error(
      "The active cloud roster returned an invalid response.",
    );
  }

  const players = data.map(
    (value) => {
      const row =
        getCloudLeaguePlayerRow(value);

      if (!row) {
        throw new Error(
          "The active cloud roster returned an invalid player row.",
        );
      }

      return mapCloudLeaguePlayer(row);
    },
  );

  validateCloudRoster(players);

  return players;
}

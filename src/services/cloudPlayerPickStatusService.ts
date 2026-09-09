import type { SupabaseClient } from "@supabase/supabase-js";

export type PlayerPickStatus = {
  playerId: string;
  name: string;
  nflTeam: string;
  pickedCount: number;
  lockedMissingCount: number;
};

export type PlayerPickStatusReport = {
  leagueId: string;
  season: number;
  week: number;
  totalGames: number;
  lockedGames: number;
  players: PlayerPickStatus[];
};

export type PickCompletionStatus = "complete" | "in-progress" | "not-started" | "missing-locked";

export function getPickCompletionStatus(player: PlayerPickStatus, totalGames: number): PickCompletionStatus {
  if (player.lockedMissingCount > 0) return "missing-locked";
  if (totalGames > 0 && player.pickedCount === totalGames) return "complete";
  return player.pickedCount > 0 ? "in-progress" : "not-started";
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("The pick status response is invalid.");
  }
  return value as Record<string, unknown>;
}

function text(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) throw new Error("The pick status response is incomplete.");
  return value;
}

function count(value: unknown): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new Error("The pick status response contains an invalid count.");
  }
  return value;
}

export async function loadCloudPlayerPickStatus(
  client: SupabaseClient,
  target: { leagueId: string; season: number; week: number },
): Promise<PlayerPickStatusReport> {
  const { data, error } = await client.rpc("load_commissioner_player_pick_status", {
    target_league_id: target.leagueId,
    target_season: target.season,
    target_week: target.week,
  });
  if (error) throw new Error("Player pick status could not be loaded. Try Refresh Status again.");
  const row = record(data);
  if (row.league_id !== target.leagueId || row.season !== target.season || row.week !== target.week || !Array.isArray(row.players)) {
    throw new Error("Player pick status did not match the selected week.");
  }
  const totalGames = count(row.total_games);
  const lockedGames = count(row.locked_games);
  if (lockedGames > totalGames) throw new Error("The pick status game counts are inconsistent.");
  const players = row.players.map(value => {
    const player = record(value);
    const pickedCount = count(player.picked_count);
    const lockedMissingCount = count(player.locked_missing_count);
    if (pickedCount > totalGames || lockedMissingCount > lockedGames || pickedCount + lockedMissingCount > totalGames) {
      throw new Error("The player pick counts are inconsistent.");
    }
    // Explicitly map the count-only contract; never retain arbitrary response fields.
    return { playerId: text(player.player_id), name: text(player.display_name), nflTeam: text(player.nfl_team), pickedCount, lockedMissingCount };
  });
  if (new Set(players.map(player => player.playerId)).size !== players.length) throw new Error("The player status list contains duplicates.");
  return { leagueId: target.leagueId, season: target.season, week: target.week, totalGames, lockedGames, players };
}

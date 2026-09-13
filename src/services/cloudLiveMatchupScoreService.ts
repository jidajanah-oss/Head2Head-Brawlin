import type { SupabaseClient } from "@supabase/supabase-js";

export type LiveMatchupScores = {
  season: number;
  week: number;
  completedGames: number;
  scores: Record<string, number>;
};

export async function loadLiveMatchupScores(
  client: SupabaseClient,
  leagueId: string,
  season: number,
  week: number,
): Promise<LiveMatchupScores> {
  const { data, error } = await client.rpc("load_live_matchup_scores", {
    target_league_id: leagueId,
    target_season: season,
    target_week: week,
  });
  if (error) throw new Error(`Unable to load live matchup scores: ${error.message}`);
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("Invalid live matchup scores.");
  const row = data as Record<string, unknown>;
  if (row.season !== season || row.week !== week ||
      typeof row.completed_games !== "number" || !Number.isInteger(row.completed_games) || row.completed_games < 0 ||
      !row.scores || typeof row.scores !== "object" || Array.isArray(row.scores)) {
    throw new Error("Invalid live matchup score summary.");
  }
  const scores: Record<string, number> = {};
  for (const [playerId, value] of Object.entries(row.scores)) {
    if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > row.completed_games) {
      throw new Error("Invalid player matchup score.");
    }
    scores[playerId] = value;
  }
  return { season, week, completedGames: row.completed_games, scores };
}

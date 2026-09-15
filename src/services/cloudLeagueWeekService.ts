import type { SupabaseClient } from "@supabase/supabase-js";

export function validateCloudWeek(value: unknown): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > 18) {
    throw new Error("The cloud returned an invalid league week.");
  }
  return value;
}

export async function loadCloudLeagueWeek(client: SupabaseClient, leagueId: string, season: number) {
  const { data, error } = await client.rpc("load_member_league_week", {
    target_league_id: leagueId, target_season: season,
  }).abortSignal(AbortSignal.timeout(15_000));
  if (error) throw new Error(`Unable to load the league week: ${error.message}`);
  return validateCloudWeek(data);
}

export async function saveCloudLeagueWeek(
  client: SupabaseClient, leagueId: string, season: number, expectedWeek: number, week: number,
) {
  validateCloudWeek(week);
  // Compare-and-set prevents a stale device from overwriting another commissioner's change.
  // The function independently checks the authenticated commissioner's account link.
  const { data, error } = await client.rpc("set_commissioner_league_week", {
    target_league_id: leagueId, target_season: season,
    expected_week: expectedWeek, target_week: week,
  }).abortSignal(AbortSignal.timeout(15_000));
  if (error) throw new Error(`Unable to save the league week: ${error.message}`);
  if (!data) throw new Error("The league week changed on another device, or you no longer have permission. Refresh and try again.");
  return validateCloudWeek(data);
}

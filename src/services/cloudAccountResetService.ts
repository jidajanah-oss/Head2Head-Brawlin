import type { SupabaseClient } from "@supabase/supabase-js";

export async function resetLinkedPlayerAccount(
  client: SupabaseClient,
  leagueId: string,
  playerId: string,
): Promise<void> {
  const { data, error } = await client.rpc(
    "reset_linked_player_account",
    {
      p_league_id: leagueId,
      p_player_id: playerId,
    },
  );

  if (error) {
    throw new Error(
      `Unable to reset the linked account: ${error.message}`,
    );
  }

  if (data !== true) {
    throw new Error(
      "The selected player does not currently have an active account link.",
    );
  }
}

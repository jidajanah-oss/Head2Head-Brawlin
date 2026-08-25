import type {
  PayoutLedgerSeasonState,
} from "../engine/payoutLedgerTypes";
import { supabaseClient } from "./supabaseClient";

type CloudPayoutLedgerRow = {
  league_id: string;
  season: number;
  ledger: PayoutLedgerSeasonState;
  schema_version: number;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

function requireSupabaseClient() {
  if (!supabaseClient) {
    throw new Error(
      "Supabase is not configured for the payout ledger.",
    );
  }

  return supabaseClient;
}

export async function loadCloudPayoutLedgerSeason(
  leagueId: string,
  season: number,
): Promise<PayoutLedgerSeasonState | null> {
  const client = requireSupabaseClient();

  const { data, error } = await client
    .from("payout_ledger_seasons")
    .select(
      "league_id,season,ledger,schema_version,updated_by,created_at,updated_at",
    )
    .eq("league_id", leagueId)
    .eq("season", season)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Unable to load cloud payout ledger: ${error.message}`,
    );
  }

  if (!data) {
    return null;
  }

  return (data as CloudPayoutLedgerRow).ledger;
}

export async function saveCloudPayoutLedgerSeason(
  leagueId: string,
  season: number,
  ledger: PayoutLedgerSeasonState,
  userId: string,
): Promise<void> {
  const client = requireSupabaseClient();

  const { error } = await client
    .from("payout_ledger_seasons")
    .upsert(
      {
        league_id: leagueId,
        season,
        ledger,
        schema_version: 1,
        updated_by: userId,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "league_id,season",
      },
    );

  if (error) {
    throw new Error(
      `Unable to save cloud payout ledger: ${error.message}`,
    );
  }
}
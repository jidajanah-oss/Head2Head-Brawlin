import { useEffect, useMemo, useRef } from "react";

import { useAuth } from "../../context/AuthContext";
import { useLeague } from "../../context/LeagueContext";
import { syncCloudRoster } from "../../services/cloudRosterService";
import { supabaseClient } from "../../services/supabaseClient";

export default function CloudRosterSync() {
  const { status, accountLink, access } = useAuth();
  const { league } = useLeague();
  const lastSuccessfulSyncKey = useRef<string | null>(null);

  const rosterSyncKey = useMemo(
    () =>
      JSON.stringify(
        league.players.map((player) => ({
          id: player.id,
          name: player.name,
          nflTeam: player.nflTeam,
          role: player.role,
          status: player.status,
          customLogo: player.customLogo ?? null,
        })),
      ),
    [league.players],
  );

  useEffect(() => {
    const client = supabaseClient;

    if (
      !client ||
      status !== "signed-in-linked" ||
      !accountLink ||
      !access.canManageLeague
    ) {
      lastSuccessfulSyncKey.current = null;
      return;
    }

    const syncKey = `${accountLink.leagueId}:${rosterSyncKey}`;
    if (lastSuccessfulSyncKey.current === syncKey) {
      return;
    }

    let canceled = false;

    const synchronize = async () => {
      try {
        await syncCloudRoster(
          client,
          accountLink.leagueId,
          league.players,
        );

        if (!canceled) {
          lastSuccessfulSyncKey.current = syncKey;
        }
      } catch (error) {
        if (!canceled) {
          console.error("Cloud roster synchronization failed.", error);
        }
      }
    };

    void synchronize();

    return () => {
      canceled = true;
    };
  }, [
    access.canManageLeague,
    accountLink,
    league.players,
    rosterSyncKey,
    status,
  ]);

  return null;
}

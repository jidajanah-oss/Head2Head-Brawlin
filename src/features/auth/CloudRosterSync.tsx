import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { useAuth } from "../../context/AuthContext";
import { useLeague } from "../../context/LeagueContext";
import { loadCloudLeagueRoster } from "../../services/cloudLeagueRosterService";
import { syncCloudRoster } from "../../services/cloudRosterService";
import { supabaseClient } from "../../services/supabaseClient";
import type { Player } from "../../types/player";

function getRosterSignature(
  players: Player[],
): string {
  return JSON.stringify(
    [...players]
      .sort((left, right) =>
        left.id.localeCompare(right.id),
      )
      .map((player) => ({
        id: player.id,
        name: player.name,
        nflTeam: player.nflTeam,
        role: player.role,
        status: player.status,
        customLogo:
          player.customLogo ?? null,
      })),
  );
}

export default function CloudRosterSync() {
  const {
    status,
    accountLink,
    access,
  } = useAuth();

  const {
    league,
    setPlayers,
  } = useLeague();

  const [
    hydratedSessionKey,
    setHydratedSessionKey,
  ] = useState<string | null>(null);

  const lastSuccessfulSyncKey =
    useRef<string | null>(null);

  const rosterSyncKey = useMemo(
    () =>
      getRosterSignature(
        league.players,
      ),
    [league.players],
  );

  const sessionKey = useMemo(() => {
    if (!accountLink) {
      return null;
    }

    return [
      accountLink.userId,
      accountLink.leagueId,
      accountLink.playerId,
      accountLink.role,
    ].join(":");
  }, [accountLink]);

  useEffect(() => {
    const client = supabaseClient;

    if (
      !client ||
      status !== "signed-in-linked" ||
      !accountLink ||
      !access.canManageLeague ||
      !sessionKey
    ) {
      lastSuccessfulSyncKey.current =
        null;

      if (
        hydratedSessionKey !== null
      ) {
        setHydratedSessionKey(null);
      }

      return;
    }

    if (
      hydratedSessionKey ===
      sessionKey
    ) {
      return;
    }

    let canceled = false;

    const hydrateCommissionerRoster =
      async () => {
        try {
          const cloudPlayers =
            await loadCloudLeagueRoster(
              client,
              accountLink.leagueId,
            );

          if (canceled) {
            return;
          }

          const cloudRosterSyncKey =
            getRosterSignature(
              cloudPlayers,
            );

          lastSuccessfulSyncKey.current =
            `${accountLink.leagueId}:${cloudRosterSyncKey}`;

          if (
            rosterSyncKey !==
            cloudRosterSyncKey
          ) {
            setPlayers(cloudPlayers);
          }

          setHydratedSessionKey(
            sessionKey,
          );
        } catch (error) {
          if (!canceled) {
            console.error(
              "Initial cloud roster loading failed.",
              error,
            );
          }
        }
      };

    void hydrateCommissionerRoster();

    return () => {
      canceled = true;
    };
  }, [
    access.canManageLeague,
    accountLink,
    hydratedSessionKey,
    rosterSyncKey,
    sessionKey,
    setPlayers,
    status,
  ]);

  useEffect(() => {
    const client = supabaseClient;

    if (
      !client ||
      status !== "signed-in-linked" ||
      !accountLink ||
      !access.canManageLeague ||
      !sessionKey ||
      hydratedSessionKey !==
        sessionKey
    ) {
      return;
    }

    const syncKey =
      `${accountLink.leagueId}:${rosterSyncKey}`;

    if (
      lastSuccessfulSyncKey.current ===
      syncKey
    ) {
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
          lastSuccessfulSyncKey.current =
            syncKey;
        }
      } catch (error) {
        if (!canceled) {
          console.error(
            "Cloud roster synchronization failed.",
            error,
          );
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
    hydratedSessionKey,
    league.players,
    rosterSyncKey,
    sessionKey,
    status,
  ]);

  return null;
}
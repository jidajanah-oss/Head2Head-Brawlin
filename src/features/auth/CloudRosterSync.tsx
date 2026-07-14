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

const EXPECTED_FULL_ROSTER_SIZE = 32;

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

function isCompleteLeagueRoster(
  players: Player[],
): boolean {
  if (
    players.length !==
    EXPECTED_FULL_ROSTER_SIZE
  ) {
    return false;
  }

  const playerIds = new Set<string>();
  const nflTeams = new Set<string>();
  let activeCommissioners = 0;
  let activeBackupCommissioners = 0;

  for (const player of players) {
    const playerId = player.id.trim();
    const nflTeam =
      player.nflTeam.trim().toUpperCase();

    if (
      !playerId ||
      !/^[A-Z]{2,3}$/.test(nflTeam) ||
      playerIds.has(playerId) ||
      nflTeams.has(nflTeam)
    ) {
      return false;
    }

    playerIds.add(playerId);
    nflTeams.add(nflTeam);

    if (
      player.status === "active" &&
      player.role === "commissioner"
    ) {
      activeCommissioners += 1;
    }

    if (
      player.status === "active" &&
      player.role ===
        "backup_commissioner"
    ) {
      activeBackupCommissioners += 1;
    }
  }

  return (
    activeCommissioners === 1 &&
    activeBackupCommissioners === 1
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
          const localPlayers =
            league.players;

          let cloudPlayers =
            await loadCloudLeagueRoster(
              client,
              accountLink.leagueId,
            );

          if (canceled) {
            return;
          }

          if (
            !isCompleteLeagueRoster(
              cloudPlayers,
            )
          ) {
            if (
              !isCompleteLeagueRoster(
                localPlayers,
              )
            ) {
              throw new Error(
                "Cloud roster hydration stopped because neither the cloud nor local runtime contains a verified 32-player roster.",
              );
            }

            await syncCloudRoster(
              client,
              accountLink.leagueId,
              localPlayers,
            );

            cloudPlayers =
              await loadCloudLeagueRoster(
                client,
                accountLink.leagueId,
              );

            if (
              !isCompleteLeagueRoster(
                cloudPlayers,
              )
            ) {
              throw new Error(
                "The cloud roster recovery did not return a verified 32-player roster.",
              );
            }
          }

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
    league.players,
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

    if (
      !isCompleteLeagueRoster(
        league.players,
      )
    ) {
      console.error(
        "Cloud roster synchronization skipped because the local runtime does not contain a verified 32-player roster.",
      );
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

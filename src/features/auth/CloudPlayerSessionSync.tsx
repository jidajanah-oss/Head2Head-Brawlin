import {
  useEffect,
  useMemo,
  useRef,
} from "react";

import { useAuth } from "../../context/AuthContext";
import { useLeague } from "../../context/LeagueContext";
import { loadCloudLeagueRoster } from "../../services/cloudLeagueRosterService";
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

export default function CloudPlayerSessionSync() {
  const {
    status,
    accountLink,
    access,
  } = useAuth();

  const {
    league,
    activePlayerId,
    setActivePlayerId,
    setPlayers,
  } = useLeague();

  const lastLoadedSessionKey =
    useRef<string | null>(null);

  const lastInitialPlayerSyncKey =
    useRef<string | null>(null);

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
      !access.isLinked ||
      !sessionKey
    ) {
      lastLoadedSessionKey.current =
        null;

      lastInitialPlayerSyncKey.current =
        null;

      return;
    }

    if (
      lastLoadedSessionKey.current ===
      sessionKey
    ) {
      return;
    }

    let canceled = false;

    const synchronizeSessionRoster =
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

          const linkedPlayerExists =
            cloudPlayers.some(
              (player) =>
                player.id ===
                accountLink.playerId,
            );

          if (!linkedPlayerExists) {
            throw new Error(
              "The linked player is missing from the cloud roster.",
            );
          }

          const localRosterSignature =
            getRosterSignature(
              league.players,
            );

          const cloudRosterSignature =
            getRosterSignature(
              cloudPlayers,
            );

          const needsInitialPlayerSync =
            lastInitialPlayerSyncKey.current !==
            sessionKey;

          const regularPlayerMustStayLocked =
            accountLink.role ===
              "player" &&
            activePlayerId !==
              accountLink.playerId;

          lastLoadedSessionKey.current =
            sessionKey;

          lastInitialPlayerSyncKey.current =
            sessionKey;

          if (
            localRosterSignature !==
            cloudRosterSignature
          ) {
            setPlayers(cloudPlayers);
          }

          if (
            activePlayerId !==
              accountLink.playerId &&
            (
              needsInitialPlayerSync ||
              regularPlayerMustStayLocked
            )
          ) {
            setActivePlayerId(
              accountLink.playerId,
            );
          }
        } catch (error) {
          if (!canceled) {
            console.error(
              "Cloud league roster loading failed.",
              error,
            );
          }
        }
      };

    void synchronizeSessionRoster();

    return () => {
      canceled = true;
    };
  }, [
    access.isLinked,
    accountLink,
    activePlayerId,
    league.players,
    sessionKey,
    setActivePlayerId,
    setPlayers,
    status,
  ]);

  useEffect(() => {
    if (
      status !== "signed-in-linked" ||
      !accountLink ||
      !sessionKey ||
      accountLink.role !== "player" ||
      lastLoadedSessionKey.current !==
        sessionKey ||
      activePlayerId ===
        accountLink.playerId
    ) {
      return;
    }

    setActivePlayerId(
      accountLink.playerId,
    );
  }, [
    accountLink,
    activePlayerId,
    sessionKey,
    setActivePlayerId,
    status,
  ]);

  return null;
}
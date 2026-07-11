import {
  useEffect,
  useMemo,
  useRef,
} from "react";

import { useAuth } from "../../context/AuthContext";
import { useLeague } from "../../context/LeagueContext";
import type { CloudAccountLink } from "../../engine/authAccessTypes";
import type { Player } from "../../types/player";

function buildLinkedPlayer(
  accountLink: CloudAccountLink,
): Player | null {
  const playerName = accountLink.playerName?.trim();
  const nflTeam = accountLink.nflTeam?.trim().toUpperCase();

  if (!playerName || !nflTeam) {
    return null;
  }

  return {
    id: accountLink.playerId,
    name: playerName,
    nflTeam,
    status: "active",
    role: accountLink.role,
  };
}

function synchronizeLinkedPlayer(
  players: Player[],
  accountLink: CloudAccountLink,
): Player[] {
  const linkedPlayer = players.find(
    (player) => player.id === accountLink.playerId,
  );

  if (!linkedPlayer) {
    const newLinkedPlayer = buildLinkedPlayer(accountLink);
    if (!newLinkedPlayer) {
      return players;
    }

    const existingPlayers =
      accountLink.role === "commissioner"
        ? players.map((player) =>
            player.role === "commissioner"
              ? { ...player, role: "player" as const }
              : player,
          )
        : players;

    return [...existingPlayers, newLinkedPlayer];
  }

  let changed = false;

  const synchronizedPlayers = players.map((player) => {
    if (player.id === accountLink.playerId) {
      const nextName =
        accountLink.playerName?.trim() || player.name;
      const nextTeam =
        accountLink.nflTeam?.trim().toUpperCase() ||
        player.nflTeam;

      if (
        player.name === nextName &&
        player.nflTeam === nextTeam &&
        player.role === accountLink.role &&
        player.status === "active"
      ) {
        return player;
      }

      changed = true;
      return {
        ...player,
        name: nextName,
        nflTeam: nextTeam,
        role: accountLink.role,
        status: "active" as const,
      };
    }

    if (
      accountLink.role === "commissioner" &&
      player.role === "commissioner"
    ) {
      changed = true;
      return {
        ...player,
        role: "player" as const,
      };
    }

    return player;
  });

  return changed ? synchronizedPlayers : players;
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

  const lastInitialSyncKey = useRef<string | null>(null);

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
    if (
      status !== "signed-in-linked" ||
      !accountLink ||
      !access.isLinked ||
      !sessionKey
    ) {
      lastInitialSyncKey.current = null;
      return;
    }

    const synchronizedPlayers = synchronizeLinkedPlayer(
      league.players,
      accountLink,
    );

    const linkedPlayerExists = synchronizedPlayers.some(
      (player) => player.id === accountLink.playerId,
    );

    if (!linkedPlayerExists) {
      return;
    }

    if (synchronizedPlayers !== league.players) {
      setPlayers(synchronizedPlayers);
    }

    const needsInitialPlayerSync =
      lastInitialSyncKey.current !== sessionKey;

    const regularPlayerMustStayLocked =
      accountLink.role === "player" &&
      activePlayerId !== accountLink.playerId;

    if (
      activePlayerId !== accountLink.playerId &&
      (needsInitialPlayerSync || regularPlayerMustStayLocked)
    ) {
      setActivePlayerId(accountLink.playerId);
    }

    lastInitialSyncKey.current = sessionKey;
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

  return null;
}

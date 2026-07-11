import {
  useEffect,
  useMemo,
  useRef,
} from "react";

import { useAuth } from "../../context/AuthContext";
import { useLeague } from "../../context/LeagueContext";
import type { Player } from "../../types/player";

function synchronizeLinkedPlayerRoles(
  players: Player[],
  linkedPlayerId: string,
  linkedRole: Player["role"],
): Player[] {
  let changed = false;

  const nextPlayers = players.map((player) => {
    let nextRole = player.role;

    if (player.id === linkedPlayerId) {
      nextRole = linkedRole;
    } else if (
      linkedRole === "commissioner" &&
      player.role === "commissioner"
    ) {
      nextRole = "player";
    }

    if (nextRole === player.role) {
      return player;
    }

    changed = true;

    return {
      ...player,
      role: nextRole,
    };
  });

  return changed
    ? nextPlayers
    : players;
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

    const linkedPlayerExists = league.players.some(
      (player) =>
        player.id === accountLink.playerId,
    );

    if (!linkedPlayerExists) {
      return;
    }

    const synchronizedPlayers =
      synchronizeLinkedPlayerRoles(
        league.players,
        accountLink.playerId,
        accountLink.role,
      );

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
      (
        needsInitialPlayerSync ||
        regularPlayerMustStayLocked
      )
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

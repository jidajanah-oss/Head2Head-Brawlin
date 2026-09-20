import { readWithDeadline, refreshOnReturn } from "../../services/liveReadRefresh";
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

function buildLinkedPlayerFallback(
  accountLink: {
    playerId: string;
    playerName?: string;
    nflTeam?: string;
    role: Player["role"];
  },
): Player | null {
  const playerId =
    accountLink.playerId.trim();
  const playerName =
    accountLink.playerName?.trim() ??
    "";
  const nflTeam =
    accountLink.nflTeam
      ?.trim()
      .toUpperCase() ?? "";

  if (
    !playerId ||
    !playerName ||
    !/^[A-Z]{2,3}$/.test(nflTeam)
  ) {
    return null;
  }

  return {
    id: playerId,
    name: playerName,
    nflTeam,
    role: accountLink.role,
    status: "active",
  };
}

function reconcileLinkedPlayer(
  players: Player[],
  linkedPlayer: Player,
): Player[] {
  const exactMatchIndex =
    players.findIndex(
      (player) =>
        player.id === linkedPlayer.id,
    );

  if (exactMatchIndex >= 0) {
    const currentPlayer =
      players[exactMatchIndex];

    if (
      currentPlayer.name ===
        linkedPlayer.name &&
      currentPlayer.nflTeam ===
        linkedPlayer.nflTeam &&
      currentPlayer.role ===
        linkedPlayer.role &&
      currentPlayer.status === "active"
    ) {
      return players;
    }

    return players.map(
      (player, index) =>
        index === exactMatchIndex
          ? {
              ...player,
              ...linkedPlayer,
              customLogo:
                player.customLogo,
            }
          : player,
    );
  }

  const franchiseMatchIndex =
    players.findIndex(
      (player) =>
        player.nflTeam ===
        linkedPlayer.nflTeam,
    );

  if (franchiseMatchIndex >= 0) {
    const franchisePlayer =
      players[franchiseMatchIndex];

    return players.map(
      (player, index) =>
        index === franchiseMatchIndex
          ? {
              ...linkedPlayer,
              customLogo:
                franchisePlayer.customLogo,
            }
          : player,
    );
  }

  const nameMatchIndex =
    players.findIndex(
      (player) =>
        player.name
          .trim()
          .toLowerCase() ===
        linkedPlayer.name
          .trim()
          .toLowerCase(),
    );

  if (nameMatchIndex >= 0) {
    const namedPlayer =
      players[nameMatchIndex];

    return players.map(
      (player, index) =>
        index === nameMatchIndex
          ? {
              ...linkedPlayer,
              customLogo:
                namedPlayer.customLogo,
            }
          : player,
    );
  }

  if (players.length < 32) {
    return [
      ...players,
      linkedPlayer,
    ];
  }

  return players;
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

  // LeagueContext creates new setter functions on render. Keep the latest
  // values here so an unrelated render cannot cancel an in-flight roster read.
  const latest = useRef({ league, activePlayerId, setActivePlayerId, setPlayers });
  latest.current = { league, activePlayerId, setActivePlayerId, setPlayers };

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

    let canceled = false;
    let running = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    // Select the trusted account immediately, without waiting for the full roster.
    if (lastInitialPlayerSyncKey.current !== sessionKey || accountLink.role === "player") {
      const current = latest.current;
      if (current.league.players.some(player => player.id === accountLink.playerId)) {
        lastInitialPlayerSyncKey.current = sessionKey;
        if (current.activePlayerId !== accountLink.playerId) current.setActivePlayerId(accountLink.playerId);
      }
    }

    const synchronizeSessionRoster =
      async () => {
        if (running) return;
        running = true;
        const fallbackPlayer =
          buildLinkedPlayerFallback(
            accountLink,
          );

        try {
          const cloudPlayers =
            await readWithDeadline(() => loadCloudLeagueRoster(
              client,
              accountLink.leagueId,
            ));

          if (canceled) {
            return;
          }

          const reconciledPlayers =
            fallbackPlayer && !cloudPlayers.some(player => player.id === accountLink.playerId)
              ? reconcileLinkedPlayer(
                  cloudPlayers,
                  fallbackPlayer,
                )
              : cloudPlayers;

          const linkedPlayerExists =
            reconciledPlayers.some(
              (player) =>
                player.id ===
                accountLink.playerId,
            );

          if (!linkedPlayerExists) {
            throw new Error(
              "The linked player is missing from both the cloud roster and the trusted account-link profile.",
            );
          }

          const current = latest.current;
          const localRosterSignature =
            getRosterSignature(
              current.league.players,
            );

          const cloudRosterSignature =
            getRosterSignature(
              reconciledPlayers,
            );

          const needsInitialPlayerSync =
            lastInitialPlayerSyncKey.current !==
            sessionKey;

          const regularPlayerMustStayLocked =
            accountLink.role === "player" &&
            current.activePlayerId !==
              accountLink.playerId;

          lastLoadedSessionKey.current =
            sessionKey;

          lastInitialPlayerSyncKey.current =
            sessionKey;

          if (
            localRosterSignature !==
            cloudRosterSignature
          ) {
            current.setPlayers(
              reconciledPlayers,
            );
          }

          if (
            current.activePlayerId !==
              accountLink.playerId &&
            (
              needsInitialPlayerSync ||
              regularPlayerMustStayLocked
            )
          ) {
            current.setActivePlayerId(
              accountLink.playerId,
            );
          }
        } catch (error) {
          if (canceled) {
            return;
          }

          clearTimeout(retryTimer);
          retryTimer = setTimeout(() => { void synchronizeSessionRoster(); }, 2_000);

          if (fallbackPlayer) {
            const current = latest.current;
            const recoveredPlayers =
              reconcileLinkedPlayer(
                current.league.players,
                fallbackPlayer,
              );

            const recovered =
              recoveredPlayers.some(
                (player) =>
                  player.id ===
                  accountLink.playerId,
              );

            if (recovered) {
              const shouldSelect = lastInitialPlayerSyncKey.current !== sessionKey || accountLink.role === "player";
              lastInitialPlayerSyncKey.current =
                sessionKey;

              if (
                getRosterSignature(
                  recoveredPlayers,
                ) !==
                getRosterSignature(
                  current.league.players,
                )
              ) {
                current.setPlayers(
                  recoveredPlayers,
                );
              }

              if (
                shouldSelect && current.activePlayerId !==
                  accountLink.playerId
              ) {
                current.setActivePlayerId(
                  accountLink.playerId,
                );
              }

              console.warn(
                "Cloud roster loading failed, so the linked player profile was recovered from the trusted account link.",
                error,
              );

              return;
            }
          }

          console.error(
            "Cloud league roster loading failed.",
            error,
          );
        } finally {
          running = false;
        }
      };

    void synchronizeSessionRoster();
    const pollTimer = window.setInterval(() => {
      void synchronizeSessionRoster();
    }, 30_000);
    const stopWake = refreshOnReturn(synchronizeSessionRoster);

    return () => {
      canceled = true;
      window.clearInterval(pollTimer);
      clearTimeout(retryTimer);
      stopWake();
    };
  }, [
    access.isLinked,
    accountLink,
    sessionKey,
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

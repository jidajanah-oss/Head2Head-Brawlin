import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useAuth } from "../../context/AuthContext";
import { useLeague } from "../../context/LeagueContext";
import { loadCloudLeagueRoster, loadProtectedCloudLeagueRoster } from "../../services/cloudLeagueRosterService";
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
  const [rosterRetryVersion, setRosterRetryVersion] = useState(0);
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

  const linkedPlayerExistsLocally =
    Boolean(
      accountLink &&
        league.players.some(
          (player) =>
            player.id ===
            accountLink.playerId,
        ),
    );

  useEffect(() => {
    if (status !== "signed-in-linked") return;
    const retry = () => setRosterRetryVersion((version) => version + 1);
    const timer = window.setInterval(retry, 30_000);
    window.addEventListener("focus", retry);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", retry); };
  }, [status]);

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
        sessionKey &&
      linkedPlayerExistsLocally &&
      league.players.length === 32
    ) {
      return;
    }

    let canceled = false;

    const synchronizeSessionRoster =
      async () => {
        const fallbackPlayer =
          buildLinkedPlayerFallback(
            accountLink,
          );

        try {
          let cloudPlayers: Player[];
          try {
            cloudPlayers = await loadCloudLeagueRoster(client, accountLink.leagueId);
          } catch {
            cloudPlayers = await loadProtectedCloudLeagueRoster(client, accountLink.leagueId);
          }
          if (cloudPlayers.length < 32) {
            cloudPlayers = await loadProtectedCloudLeagueRoster(client, accountLink.leagueId);
          }
          if (cloudPlayers.length !== 32) {
            throw new Error("The member roster read did not return all 32 active players.");
          }

          if (canceled) {
            return;
          }

          const reconciledPlayers =
            fallbackPlayer
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

          const localRosterSignature =
            getRosterSignature(
              league.players,
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
            setPlayers(
              reconciledPlayers,
            );
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
          if (canceled) {
            return;
          }

          if (fallbackPlayer) {
            const recoveredPlayers =
              reconcileLinkedPlayer(
                league.players,
                fallbackPlayer,
              );

            const recovered =
              recoveredPlayers.some(
                (player) =>
                  player.id ===
                  accountLink.playerId,
              );

            if (recovered) {
              lastInitialPlayerSyncKey.current =
                sessionKey;

              if (
                getRosterSignature(
                  recoveredPlayers,
                ) !==
                getRosterSignature(
                  league.players,
                )
              ) {
                setPlayers(
                  recoveredPlayers,
                );
              }

              if (
                activePlayerId !==
                accountLink.playerId
              ) {
                setActivePlayerId(
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
    linkedPlayerExistsLocally,
    sessionKey,
    rosterRetryVersion,
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

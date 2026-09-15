import {
  useEffect,
  useRef,
} from "react";

import { useAuth } from "../../context/AuthContext";
import { useLeague } from "../../context/LeagueContext";
import { useNFL } from "../../context/NFLContext";
import {
  applyPickerClickerFallbacks,
  ensurePickerClickerWeekState,
  getPickerClickerFallbackPickId,
  getPickerClickerWeekId,
  type PickerClickerWeekState,
} from "../../engine";
import {
  useCloudPickHydration,
} from "../../services/cloudPickHydrationService";

function repairWeekOneFallbackState(
  weekState: PickerClickerWeekState,
  players: Array<{
    id: string;
    name: string;
  }>,
): PickerClickerWeekState {
  if (
    weekState.season !== 2026 ||
    weekState.week !== 1
  ) {
    return weekState;
  }

  const jax = players.find(
    (player) =>
      player.name.trim().toLowerCase() ===
      "jax",
  );

  const gMan = players.find(
    (player) =>
      player.name.trim().toLowerCase() ===
      "g-man",
  );

  if (!jax || !gMan) {
    return weekState;
  }

  const gameId = "401872657";

  const existingJaxFallback =
    weekState.fallbackPicks?.[
      jax.id
    ]?.[gameId];

  const fallbackPlayerIds =
    Object.keys(
      weekState.fallbackPicks ?? {},
    ).filter(
      (playerId) =>
        Object.keys(
          weekState.fallbackPicks[
            playerId
          ] ?? {},
        ).length > 0,
    );

  const totalFallbacks =
    Object.values(
      weekState.fallbackPicks ?? {},
    ).reduce(
      (total, playerFallbacks) =>
        total +
        Object.keys(
          playerFallbacks ?? {},
        ).length,
      0,
    );

  const jaxSelectedThisGame =
    Boolean(
      weekState
        .playerSelectedPicks?.[
          jax.id
        ]?.[gameId],
    );

  const alreadyCorrect =
    totalFallbacks === 1 &&
    fallbackPlayerIds.length === 1 &&
    fallbackPlayerIds[0] === jax.id &&
    existingJaxFallback?.gameId ===
      gameId &&
    existingJaxFallback?.playerId ===
      jax.id &&
    existingJaxFallback
      ?.sourcePlayerId === gMan.id &&
    existingJaxFallback?.team === "LAR" &&
    existingJaxFallback?.status ===
      "copied" &&
    weekState.ineligiblePlayerIds
      .length === 1 &&
    weekState.ineligiblePlayerIds[0] ===
      jax.id &&
    !jaxSelectedThisGame;

  if (alreadyCorrect) {
    return weekState;
  }

  const fallback = {
    id: getPickerClickerFallbackPickId(
      2026,
      1,
      jax.id,
      gameId,
    ),
    season: 2026,
    week: 1,
    gameId,
    playerId: jax.id,
    sourcePlayerId: gMan.id,
    team: "LAR",
    status: "copied" as const,
    appliedAt:
      existingJaxFallback?.appliedAt ??
      weekState.assignment.assignedAt,
  };

  const nextSelected = {
    ...(weekState
      .playerSelectedPicks ?? {}),
  };

  if (nextSelected[jax.id]) {
    const jaxSelections = {
      ...nextSelected[jax.id],
    };

    delete jaxSelections[gameId];

    if (
      Object.keys(jaxSelections)
        .length === 0
    ) {
      delete nextSelected[jax.id];
    } else {
      nextSelected[jax.id] =
        jaxSelections;
    }
  }

  return {
    ...weekState,
    fallbackPicks: {
      [jax.id]: {
        [gameId]: fallback,
      },
    },
    playerSelectedPicks:
      nextSelected,
    ineligiblePlayerIds: [
      jax.id,
    ],
    updatedAt:
      new Date().toISOString(),
  };
}

function PickerClickerSync() {
  const {
    status,
    accountLink,
    access,
  } = useAuth();

  const {
    league,
    picks,
    pickerClickerHistory,
    upsertPickerClickerWeekState,
  } = useLeague();

  const {
    season,
    week,
    snapshot,
  } = useNFL();

  const hydrationStatus =
    useCloudPickHydration(
      accountLink,
      season,
      week,
    );

  const pendingWeekStatesRef =
    useRef<
      Record<
        string,
        PickerClickerWeekState
      >
    >({});

  useEffect(() => {
    if (
      status !==
        "signed-in-linked" ||
      !accountLink ||
      !access.isLinked ||
      hydrationStatus !== "ready" ||
      !snapshot
    ) {
      return;
    }

    if (
      snapshot.season !== season ||
      snapshot.week !== week ||
      week !== league.currentWeek
    ) {
      return;
    }

    const linkedPlayer =
      league.players.find(
        (player) =>
          player.id ===
          accountLink.playerId,
      );

    if (!linkedPlayer) {
      return;
    }

    const weekStateId =
      getPickerClickerWeekId(
        season,
        week,
      );

    const persistedWeekState =
      pickerClickerHistory[
        weekStateId
      ];

    const pendingWeekState =
      pendingWeekStatesRef.current[
        weekStateId
      ];

    const ensuredWeekState =
      persistedWeekState ??
      pendingWeekState ??
      ensurePickerClickerWeekState({
        players: league.players,
        history:
          pickerClickerHistory,
        season,
        week,
      });

    if (!ensuredWeekState) {
      return;
    }

    const repairedWeekState =
      repairWeekOneFallbackState(
        ensuredWeekState,
        league.players,
      );

    const updatedWeekState =
      applyPickerClickerFallbacks({
        players: [linkedPlayer],
        picks,
        games:
          snapshot.weekGames,
        weekState:
          repairedWeekState,
      });

    if (
      updatedWeekState !==
      persistedWeekState
    ) {
      pendingWeekStatesRef.current[
        weekStateId
      ] = updatedWeekState;

      upsertPickerClickerWeekState(
        updatedWeekState,
      );

      return;
    }

    delete pendingWeekStatesRef
      .current[weekStateId];
  }, [
    access.isLinked,
    accountLink,
    hydrationStatus,
    league.currentWeek,
    league.players,
    pickerClickerHistory,
    picks,
    season,
    snapshot,
    status,
    upsertPickerClickerWeekState,
    week,
  ]);

  return null;
}

export default PickerClickerSync;

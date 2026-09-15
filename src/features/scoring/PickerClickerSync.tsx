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
  getPickerClickerWeekId,
  type PickerClickerWeekState,
} from "../../engine";
import {
  useCloudPickHydration,
} from "../../services/cloudPickHydrationService";

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

  const pendingWeekStatesRef = useRef<
    Record<string, PickerClickerWeekState>
  >({});

  useEffect(() => {
    if (
      status !== "signed-in-linked" ||
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

    const linkedPlayer = league.players.find(
      (player) =>
        player.id === accountLink.playerId,
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

    const updatedWeekState =
      applyPickerClickerFallbacks({
        players: [linkedPlayer],
        picks,
        games: snapshot.weekGames,
        weekState:
          ensuredWeekState,
      });

    if (
      !persistedWeekState ||
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

    delete pendingWeekStatesRef.current[
      weekStateId
    ];
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

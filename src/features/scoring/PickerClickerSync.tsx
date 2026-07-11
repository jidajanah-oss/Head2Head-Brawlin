import {
  useEffect,
  useRef,
} from "react";

import { useLeague } from "../../context/LeagueContext";
import { useNFL } from "../../context/NFLContext";
import {
  applyPickerClickerFallbacks,
  ensurePickerClickerWeekState,
  getPickerClickerWeekId,
  type PickerClickerWeekState,
} from "../../engine";

function PickerClickerSync() {
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

  const pendingWeekStatesRef = useRef<
    Record<string, PickerClickerWeekState>
  >({});

  useEffect(() => {
    if (!snapshot) {
      return;
    }

    if (
      snapshot.season !== season ||
      snapshot.week !== week ||
      week !== league.currentWeek
    ) {
      return;
    }

    const weekStateId =
      getPickerClickerWeekId(
        season,
        week
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
        players: league.players,
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
        updatedWeekState
      );

      return;
    }

    delete pendingWeekStatesRef.current[
      weekStateId
    ];
  }, [
    league.currentWeek,
    league.players,
    pickerClickerHistory,
    picks,
    season,
    snapshot,
    upsertPickerClickerWeekState,
    week,
  ]);

  return null;
}

export default PickerClickerSync;
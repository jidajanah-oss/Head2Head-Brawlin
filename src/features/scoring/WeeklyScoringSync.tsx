import { useEffect } from "react";

import { useLeague } from "../../context/LeagueContext";
import { useNFL } from "../../context/NFLContext";
import {
  buildEffectiveHeadToHeadPicks,
  buildFinalizedWeeklyScoringRecord,
  getPickerClickerWeekId,
  getWeeklyScoringRecordId,
  inspectNFLWeekCompletion,
} from "../../engine";

function areGameResultsEqual(
  currentResults: Record<string, string>,
  nextResults: Record<string, string>
) {
  const currentEntries = Object.entries(currentResults);
  const nextEntries = Object.entries(nextResults);

  if (currentEntries.length !== nextEntries.length) {
    return false;
  }

  return nextEntries.every(
    ([gameId, winner]) => currentResults[gameId] === winner
  );
}

function WeeklyScoringSync() {
  const {
    league,
    picks,
    gameResults,
    setGameResults,
    scoringHistory,
    addFinalizedWeeklyScoringRecord,
    pickerClickerHistory,
  } = useLeague();

  const { season, week, snapshot } = useNFL();

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

    const completion = inspectNFLWeekCompletion(
      snapshot.nflGames,
      season,
      week
    );

    const mergedGameResults = {
      ...gameResults,
      ...completion.gameResults,
    };

    if (!areGameResultsEqual(gameResults, mergedGameResults)) {
      setGameResults(mergedGameResults);
    }

    const scoringRecordId = getWeeklyScoringRecordId(
      season,
      week
    );

    if (
      !completion.isComplete ||
      scoringHistory[scoringRecordId]
    ) {
      return;
    }

    const pickerClickerWeekId = getPickerClickerWeekId(
      season,
      week
    );

    const pickerClickerWeekState =
      pickerClickerHistory[pickerClickerWeekId];

    if (!pickerClickerWeekState) {
      return;
    }

    const processedLockedGameIds = new Set(
      pickerClickerWeekState.lockedGameIds
    );

    const completedGamesProcessed =
      completion.completedGameIds.every((gameId) =>
        processedLockedGameIds.has(gameId)
      );

    if (!completedGamesProcessed) {
      return;
    }

    const effectivePicks = buildEffectiveHeadToHeadPicks({
      picks,
      pickerClickerHistory,
      season,
      throughWeek: week,
    });

    const scoringRecord =
      buildFinalizedWeeklyScoringRecord({
        players: league.players,
        picks: effectivePicks,
        nflGames: snapshot.nflGames,
        season,
        week,
        pickerClickerWeekState,
      });

    if (!scoringRecord) {
      return;
    }

    addFinalizedWeeklyScoringRecord(scoringRecord);
  }, [
    addFinalizedWeeklyScoringRecord,
    gameResults,
    league.currentWeek,
    league.players,
    pickerClickerHistory,
    picks,
    scoringHistory,
    season,
    setGameResults,
    snapshot,
    week,
  ]);

  return null;
}

export default WeeklyScoringSync;
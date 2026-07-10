import { useEffect } from "react";

import { useLeague } from "../../context/LeagueContext";
import { useNFL } from "../../context/NFLContext";
import {
  buildFinalizedWeeklyScoringRecord,
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

    if (
      !areGameResultsEqual(
        gameResults,
        mergedGameResults
      )
    ) {
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

    const scoringRecord =
      buildFinalizedWeeklyScoringRecord({
        players: league.players,
        picks,
        nflGames: snapshot.nflGames,
        season,
        week,
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
import type { NFLScheduleGame } from "../../types/nfl";
import type {
  WeekState,
  WeeklyMatchup,
  WeeklyPickSheet,
} from "../../types/weekState";

interface CreateWeekStateInput {
  season: number;
  week: number;
  nflGames: NFLScheduleGame[];
  playerMatchups: WeeklyMatchup[];
  pickSheets: WeeklyPickSheet[];
}

export function createWeekState({
  season,
  week,
  nflGames,
  playerMatchups,
  pickSheets,
}: CreateWeekStateInput): WeekState {
  return {
    season,
    week,
    nflGames,
    playerMatchups,
    pickSheets,
    picksLocked: false,
    resultsFinalized: false,
    completed: false,
  };
}
import type { EngineContext } from "../types";
import type { WeekState } from "../../types/weekState";

import { generateByeWeeks } from "./generateByeWeeks";
import { generateMatchups } from "./generateMatchups";
import { generatePickSheets } from "./generatePickSheets";
import { createWeekState } from "./weekFactory";

export function generateWeekStates(
  context: EngineContext
): WeekState[] {
  return context.schedule.map((scheduleWeek) => {
    const byePlayers = generateByeWeeks({
      season: context.season,
      week: scheduleWeek.week,
      players: context.players,
      nflGames: scheduleWeek.games,
    });

    const playerMatchups = generateMatchups(
      scheduleWeek.week,
      scheduleWeek.games,
      context.players,
      byePlayers
    );

    const pickSheets = generatePickSheets(
      scheduleWeek.week,
      scheduleWeek.games,
      context.players,
      byePlayers
    );

    return createWeekState({
      season: context.season,
      week: scheduleWeek.week,
      nflGames: scheduleWeek.games,
      playerMatchups,
      pickSheets,
    });
  });
}
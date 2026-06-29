import type { LeaguePlayer } from "../../types/leagueModel";
import type { NFLScheduleWeek } from "../../types/nfl";

export interface EngineContext {
  season: number;
  players: LeaguePlayer[];
  schedule: NFLScheduleWeek[];
}
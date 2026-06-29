import type { LeaguePlayer } from "../../types/leagueModel";
import type { NFLScheduleGame } from "../../types/nfl";
import type { PlayerBye } from "./PlayerBye";

export interface MatchupContext {
  season: number;
  week: number;
  players: LeaguePlayer[];
  nflGames: NFLScheduleGame[];
  byePlayers: PlayerBye[];
}
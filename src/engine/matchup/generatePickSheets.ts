import type { LeaguePlayer } from "../../types/leagueModel";
import type { NFLScheduleGame } from "../../types/nfl";
import type { PlayerBye } from "../types";
import type { WeeklyPickSheet } from "../../types/weekState";

function isByePlayer(playerId: string, byePlayers: PlayerBye[]) {
  return byePlayers.some((bye) => bye.playerId === playerId);
}

export function generatePickSheets(
  week: number,
  nflGames: NFLScheduleGame[],
  players: LeaguePlayer[],
  byePlayers: PlayerBye[]
): WeeklyPickSheet[] {
  return players
    .filter((player) => !isByePlayer(player.id, byePlayers))
    .map((player) => ({
      playerId: player.id,
      week,
      picks: nflGames.map((game) => ({
        gameId: game.id,
        selectedTeam: "",
        locked: false,
      })),
      submitted: false,
      autoPickerClicker: false,
    }));
}
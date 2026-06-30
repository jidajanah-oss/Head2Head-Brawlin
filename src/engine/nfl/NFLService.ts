import { NFLGameAdapter } from "./NFLGameAdapter";
import { NFLGameSyncEngine } from "./NFLGameSyncEngine";
import type { NFLGame } from "./NFLTypes";
import type { WeekGame } from "../weekManager/WeekGameManager";

export interface NFLWeekSnapshot {
  season: number;
  week: number;
  syncedAt: string;
  nflGames: NFLGame[];
  weekGames: WeekGame[];
}

export class NFLService {
  static async loadWeek(
    season: number,
    week: number
  ): Promise<NFLWeekSnapshot> {
    const result = await NFLGameSyncEngine.syncWeek(season, week);

    return {
      season: result.season,
      week: result.week,
      syncedAt: result.syncedAt,
      nflGames: result.games,
      weekGames: NFLGameAdapter.toWeekGames(result.games),
    };
  }

  static async loadGame(gameId: string): Promise<NFLGame | null> {
    return NFLGameSyncEngine.syncGame(gameId);
  }

  static async refreshWeek(
    season: number,
    week: number
  ): Promise<NFLWeekSnapshot> {
    return this.loadWeek(season, week);
  }
}
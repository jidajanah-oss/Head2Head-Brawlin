import { NFLProviderFactory } from "./NFLProviderFactory";
import type { NFLGame } from "./NFLTypes";

export interface NFLGameSyncResult {
  season: number;
  week: number;
  games: NFLGame[];
  syncedAt: string;
}

export class NFLGameSyncEngine {
  static async syncWeek(
    season: number,
    week: number
  ): Promise<NFLGameSyncResult> {
    const provider = NFLProviderFactory.getProvider();
    const games = await provider.getGamesByWeek(season, week);

    return {
      season,
      week,
      games,
      syncedAt: new Date().toISOString(),
    };
  }

  static async syncGame(gameId: string): Promise<NFLGame | null> {
    const provider = NFLProviderFactory.getProvider();

    return provider.getGameById(gameId);
  }
}
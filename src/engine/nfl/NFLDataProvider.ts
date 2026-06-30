import type { NFLGame } from "./NFLTypes";

export interface NFLDataProvider {
  getGamesByWeek(season: number, week: number): Promise<NFLGame[]>;
  getGameById(gameId: string): Promise<NFLGame | null>;
}
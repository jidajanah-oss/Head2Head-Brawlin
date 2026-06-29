import type { NFLDataProvider } from "./NFLDataProvider";
import type { NFLGame } from "./NFLTypes";

const mockGames: NFLGame[] = [
  {
    id: "2026-W1-G1",
    week: 1,
    season: 2026,
    kickoff: "2026-09-10T20:20:00-04:00",
    status: "scheduled",
    awayTeam: {
      id: "DAL",
      abbreviation: "DAL",
      name: "Cowboys",
      displayName: "Dallas Cowboys",
    },
    homeTeam: {
      id: "PHI",
      abbreviation: "PHI",
      name: "Eagles",
      displayName: "Philadelphia Eagles",
    },
    score: {
      away: 0,
      home: 0,
    },
  },
];

export class MockNFLDataProvider implements NFLDataProvider {
  async getGamesByWeek(season: number, week: number): Promise<NFLGame[]> {
    return mockGames.filter(
      game => game.season === season && game.week === week
    );
  }

  async getGameById(gameId: string): Promise<NFLGame | null> {
    return mockGames.find(game => game.id === gameId) ?? null;
  }
}
import type { NFLGame } from "./NFLTypes";
import type { WeekGame } from "../weekManager/WeekGameManager";

export class NFLGameAdapter {
  /**
   * Convert a provider game into the application's WeekGame model.
   */
  static toWeekGame(game: NFLGame): WeekGame {
    return {
      id: game.id,
      week: game.week,
      awayTeam: game.awayTeam.abbreviation,
      homeTeam: game.homeTeam.abbreviation,
      kickoff: game.kickoff,
      final: game.status === "final",
    };
  }

  /**
   * Convert an entire week's schedule.
   */
  static toWeekGames(games: NFLGame[]): WeekGame[] {
    return games.map(game => this.toWeekGame(game));
  }
}
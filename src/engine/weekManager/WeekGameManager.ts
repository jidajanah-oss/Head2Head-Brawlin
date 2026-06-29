import { LiveGameStatusEngine } from "../gameStatus/LiveGameStatusEngine";

export interface WeekGame {
  id: string;
  week: number;
  homeTeam: string;
  awayTeam: string;
  kickoff: string;
  final?: boolean;
}

export class WeekGameManager {
  static getGamesForWeek(
    week: number,
    games: WeekGame[]
  ): WeekGame[] {
    return games.filter(game => game.week === week);
  }

  static getGameById(
    id: string,
    games: WeekGame[]
  ): WeekGame | undefined {
    return games.find(game => game.id === id);
  }

  static getGameStatus(game: WeekGame) {
    return LiveGameStatusEngine.getStatus({
      kickoffTime: game.kickoff,
      isFinal: game.final ?? false,
    });
  }

  static getLockedGames(
    week: number,
    games: WeekGame[]
  ) {
    return this.getGamesForWeek(week, games)
      .filter(game =>
        LiveGameStatusEngine.isLocked({
          kickoffTime: game.kickoff,
          isFinal: game.final ?? false,
        })
      );
  }

  static getOpenGames(
    week: number,
    games: WeekGame[]
  ) {
    return this.getGamesForWeek(week, games)
      .filter(game =>
        LiveGameStatusEngine.isPlayable({
          kickoffTime: game.kickoff,
          isFinal: game.final ?? false,
        })
      );
  }
}